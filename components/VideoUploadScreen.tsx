import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { Buffer } from 'buffer';
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
  const [status, setStatus] = useState<string | null>(null);
  const [video, setVideo] = useState<any>(null);

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

  const compressVideo = async (uri: string): Promise<string> => {
    try {
      setStatus('Compressing video...');
      const compressedUri = await Video.compress(
        uri,
        {
          compressionMethod: 'auto', // Balances quality and size
          maxSize: 720, // Maintain 720p height
          bitrate: 2000000, // ~2 Mbps
        },
        (progress: number) => {
          setStatus(`Compressing... ${(progress * 100).toFixed(2)}%`);
        }
      );
      setStatus('Compression complete!');
      return compressedUri;
    } catch (error) {
      console.error('Compression error:', error);
      setStatus('❌ Compression failed');
      throw error;
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
      // Compress the video
      const compressedUri = await compressVideo(video.uri);

      // Fetch the compressed video as a blob
      const res = await fetch(compressedUri);
      const blob = await res.blob();

      // Log compressed file size
      console.log('Compressed file size:', blob.size / 1024 / 1024, 'MB');

      const upload = new Upload(blob, {
        endpoint: 'https://api.tusky.io/uploads',
        headers: {
          'Api-Key': API_KEY,
        },
        metadata: {
          filename: video.uri.split('/').pop(),
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
          console.log("✅ Upload complete!", fileId);
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
      <Button title="Pick Video from Gallery" onPress={pickVideo} disabled={uploading} />
      {video && (
        <Text style={{ marginVertical: 10 }}>
          Selected: {video.uri.split('/').pop()}
        </Text>
      )}
      <Button
        title={uploading ? 'Processing...' : 'Upload Video'}
        onPress={uploadToTusky}
        disabled={!video || uploading}
      />
      {uploading && <ActivityIndicator style={{ marginTop: 20 }} />}
      {status && <Text style={{ marginTop: 10, textAlign: 'center' }}>{status}</Text>}
    </View>
  );
};

export default TuskyUpload;