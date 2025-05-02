import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Button, Text, View } from 'react-native';
import { Upload } from 'tus-js-client'; // Import the tus-js-client

// Path to store the file_id.json in the document directory
const FILE_IDS_PATH = FileSystem.documentDirectory + 'file_id.json';
const API_KEY = '4c52d09a-3fdb-4972-9f9b-289d0b0e4c78'; // Replace with your actual API key
const VAULT_ID = '9c83bf67-7890-4b78-aed7-cad9f391da48'; // Replace with your actual vault ID

const TuskyUpload = () => {
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [fileIds, setFileIds] = useState<string[]>([]);
    const [video, setVideo] = useState<any>(null); // For storing selected video

    // Function to save file ID to the JSON file
    const saveFileId = async (newFileId: string) => {
        try {
            const fileExists = await FileSystem.getInfoAsync(FILE_IDS_PATH);
            let fileIdsArray: string[] = [];

            if (fileExists.exists) {
                const fileContents = await FileSystem.readAsStringAsync(FILE_IDS_PATH);
                fileIdsArray = JSON.parse(fileContents);
            } else {
                fileIdsArray = [];
            }

            if (!fileIdsArray.includes(newFileId)) {
                fileIdsArray.push(newFileId);
            }

            await FileSystem.writeAsStringAsync(FILE_IDS_PATH, JSON.stringify(fileIdsArray));

            setFileIds(fileIdsArray);
            console.log('File ID saved:', newFileId);
        } catch (error) {
            console.error('Error saving file ID:', error);
            setStatus('❌ Error saving file ID');
        }
    };

    // Function to load the file IDs from the JSON file
    const loadFileIds = async () => {
        try {
            const fileExists = await FileSystem.getInfoAsync(FILE_IDS_PATH);
            if (fileExists.exists) {
                const fileContents = await FileSystem.readAsStringAsync(FILE_IDS_PATH);
                const loadedFileIds = JSON.parse(fileContents);
                setFileIds(loadedFileIds);
            } else {
                console.log('File does not exist, initializing an empty file.');
            }
        } catch (error) {
            console.error('Error loading file IDs:', error);
        }
    };

    // Function to pick a video from the gallery
    const pickVideo = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            alert('Permission required to access media library.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            quality: 1,
        });

        if (!result.canceled && result.assets?.length > 0) {
            setVideo(result.assets[0]);
            setStatus(null);
        }
    };

    // Function to upload video to Tusky and get the file ID
    const uploadToTusky = async () => {
        if (!video) return;
        setUploading(true);
        setStatus('Uploading...');

        try {
            const res = await fetch(video.uri);
            const blob = await res.blob();

            // Initialize the tus client upload
            const upload = new Upload(blob, {
                endpoint: 'https://api.tusky.io/uploads', // Tusky endpoint
                headers: {
                    'Api-Key': API_KEY,
                },
                metadata: {
                    filename: video.uri.split('/').pop(),
                    filetype: 'video/mp4', // Assuming video type is mp4
                    vaultId: VAULT_ID,
                },
                uploadSize: blob.size,
                onError: (error) => {
                    console.error('Upload failed:', error);
                    setStatus('❌ Upload failed');
                    setUploading(false);
                },
                onProgress: (bytesUploaded, bytesTotal) => {
                    const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
                    setStatus(`Uploading... ${percentage}%`);
                },
                onSuccess: () => {
                    console.log('✅ Upload complete!');
                    const fileId: any = upload?.url?.split('/').pop(); // Extract file ID from URL
                    console.log('File ID:', fileId);
                    setStatus(`Video uploaded! File ID: ${fileId}`);

                    // Save the file ID after successful upload
                    saveFileId(fileId);

                    setUploading(false);
                },
            });

            upload.start();
        } catch (err) {
            console.error('Upload error:', err);
            setStatus('❌ Upload failed');
            setUploading(false);
        }
    };

    useEffect(() => {
        loadFileIds();
    }, []);

    return (
        <View style={{ padding: 120 }}>
            <Button title="Pick Video from Gallery" onPress={pickVideo} />
            {video && (
                <Text style={{ marginTop: 10 }}>
                    Selected: {video.uri.split('/').pop()}
                </Text>
            )}
            <Button
                title={uploading ? 'Uploading...' : 'Upload Video'}
                onPress={uploadToTusky}
                disabled={!video || uploading}
            />
            {uploading && <ActivityIndicator style={{ marginTop: 20 }} />}
            {status && <Text style={{ marginTop: 10 }}>{status}</Text>}

            
        </View>
    );
};

export default TuskyUpload;
