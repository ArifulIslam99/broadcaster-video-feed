import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { Buffer } from 'buffer';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Button, Text, View } from 'react-native';
import { Video } from 'react-native-compressor';
import { Upload } from 'tus-js-client';

import { SECRET_KEY_HEX } from "../config";

// Constants
const API_KEY = '4c52d09a-3fdb-4972-9f9b-289d0b0e4c78';
const VAULT_ID = '9c83bf67-7890-4b78-aed7-cad9f391da48';
const PACKAGE_ID = '0x942ea57ff14fcef33b2dbe9cc888d256edad279c4e483e6c31173e722306d639';
const OBJECT_ID = "0xbacf4415d279fc240f1de1967eaca4933502ca7803e3cf8295cadad9eca4dacf";

// Sui setup
const secretKey = Buffer.from(SECRET_KEY_HEX, "hex");
const keypair = Ed25519Keypair.fromSecretKey(secretKey);
const client = new SuiClient({ url: getFullnodeUrl("testnet") });

const TuskyUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [video, setVideo] = useState<{ uri: string; name: string } | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const pickVideoFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      console.log('Media library permission denied');
      setStatus('Permission required to access media library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1, // Max quality; compression handled separately
    });

    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      setVideo({
        uri: asset.uri,
        name: asset.fileName || asset.uri.split('/').pop() || 'video.mp4',
      });
      setStatus(null);
      setRetryCount(0);
    }
  };

  const pickVideoFromFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'video/*',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      setVideo({
        uri: asset.uri,
        name: asset.name || asset.uri.split('/').pop() || 'video.mp4',
      });
      setStatus(null);
      setRetryCount(0);
    }
  };

  const compressVideo = async (inputUri: string): Promise<string> => {
    setCompressing(true);
    setStatus('Compressing video...');
    console.log('Starting compression for:', inputUri);

    try {
      // Type assertion to bypass TypeScript errors
      const options: any = {
        compressionMethod: 'auto',
        maxSize: 720, // 720p
        bitrate: 2000000, // 2 Mbps
        keyframeInterval: 1, // Keyframe every 1s
        videoCodec: 'h264', // H.264
        movflags: 'faststart', // Optimize for streaming
      };

      const compressedUri = await Video.compress(inputUri, options, (progress: number) => {
        console.log(`Compression progress: ${(progress * 100).toFixed(2)}%`);
        setStatus(`Compressing... ${(progress * 100).toFixed(2)}%`);
      });

      console.log('Compression complete:', compressedUri);
      const originalSize = await (await fetch(inputUri)).blob().then(blob => blob.size);
      const compressedSize = await (await fetch(compressedUri)).blob().then(blob => blob.size);
      console.log(`Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Compressed size: ${(compressedSize / 1024 / 1024).toFixed(2)} MB`);
      setCompressing(false);
      setRetryCount(0);
      return compressedUri;
    } catch (error) {
      console.error('Compression error (attempt', retryCount + 1, '):', error);
      setRetryCount((prev) => prev + 1);
      console.log('Retrying compression (attempt', retryCount + 2, ')');
      setStatus('Retrying compression...');
      // Retry compression
      return compressVideo(inputUri);
    }
  };

  const saveFileIdOnChain = async (fileId: string) => {
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::file_storage::add_file_id`,
        arguments: [tx.object(OBJECT_ID), tx.pure.string(fileId)],
      });

      await client.signAndExecuteTransaction({ transaction: tx, signer: keypair });
      setStatus("✅ Video Stored Onchain!");
    } catch (error) {
      console.error("Error storing file ID on-chain:", error);
      setStatus("❌ Error storing file ID");
    }
  };

  const uploadToTusky = async () => {
    if (!video) return;
    setUploading(true);
    setStatus("Preparing upload...");

    try {
      // Compress video
      const compressedUri = await compressVideo(video.uri);
      const res = await fetch(compressedUri);
      const blob = await res.blob();

      console.log('Compressed file size:', blob.size / 1024 / 1024, 'MB');

      const upload = new Upload(blob, {
        endpoint: 'https://api.tusky.io/uploads',
        headers: {
          'Api-Key': API_KEY,
        },
        metadata: {
          filename: video.name,
          filetype: 'video/mp4',
          vaultId: VAULT_ID,
        },
        uploadSize: blob.size,
        onError: (error) => {
          console.error("Upload failed:", error);
          setStatus("❌ Upload failed");
          setUploading(false);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
          setStatus(`Uploading... ${percentage}%`);
        },
        onSuccess: () => {
          const fileId = upload?.url?.split('/').pop();
          console.log("✅ Upload complete! File ID:", fileId);
          setStatus(`Video uploaded! File ID: ${fileId}`);
          if (fileId) saveFileIdOnChain(fileId);
          setUploading(false);
        },
      });

      upload.start();
    } catch (err) {
      console.error("Upload error:", err);
      setStatus("❌ Upload failed");
      setUploading(false);
    }
  };

  return (
    <View style={{ padding: 20, flex: 1, justifyContent: 'center' }}>
      <Button
        title="Pick Video from Gallery"
        onPress={pickVideoFromGallery}
        disabled={uploading || compressing}
      />
      <Button
        title="Pick Video from Files"
        onPress={pickVideoFromFiles}
        disabled={uploading || compressing}
      />
      {video && (
        <Text style={{ marginVertical: 10 }}>
          Selected: {video.name}
        </Text>
      )}
      <Button
        title={compressing ? 'Compressing...' : uploading ? 'Uploading...' : 'Upload Video'}
        onPress={uploadToTusky}
        disabled={!video || uploading || compressing}
      />
      {(uploading || compressing) && <ActivityIndicator style={{ marginTop: 20 }} />}
      {status && <Text style={{ marginTop: 10, textAlign: 'center' }}>{status}</Text>}
    </View>
  );
};

export default TuskyUpload;