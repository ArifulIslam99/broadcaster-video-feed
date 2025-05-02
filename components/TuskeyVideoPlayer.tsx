import { ResizeMode, Video } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, View } from 'react-native';

const { width, height } = Dimensions.get('window');

const API_KEY = '4c52d09a-3fdb-4972-9f9b-289d0b0e4c78';

interface Props {
  fileId: string;
  isVisible: boolean;
}

export default function TuskyVideoPlayer({ fileId, isVisible }: Props) {
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); // Default to false until isVisible triggers it
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    if (!isVisible || videoUri) return;

    const downloadVideo = async () => {
      setLoading(true);
      try {
        const uri = FileSystem.documentDirectory + `${fileId}.mp4`;

        // Check if the file already exists
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists) {
          setVideoUri(uri);
          return;
        }

        const downloadResumable = FileSystem.createDownloadResumable(
          `https://api.tusky.io/files/${fileId}/data`,
          uri,
          { headers: { 'Api-Key': API_KEY } }
        );
        const result = await downloadResumable.downloadAsync();
        if (result?.uri) setVideoUri(result.uri);
      } catch (e) {
        console.error(`Failed to download video ${fileId}`, e);
      } finally {
        setLoading(false);
      }
    };

    downloadVideo();
  }, [fileId, isVisible, videoUri]);

  useEffect(() => {
    if (videoRef.current) {
      isVisible ? videoRef.current.playAsync() : videoRef.current.pauseAsync();
    }
  }, [isVisible]);

  if (loading || !videoUri) {
    return (
      <View style={styles.centered}>
        {loading && <ActivityIndicator color="#fff" size="large" />}
      </View>
    );
  }

  return (
    <Video
      ref={videoRef}
      useNativeControls={true}
      source={{ uri: videoUri }}
      resizeMode={ResizeMode.COVER}
      isLooping
      shouldPlay={isVisible}
      style={styles.video}
    />
  );
}

const styles = StyleSheet.create({
  video: {
    width,
    height,
    backgroundColor: '#000',
  },
  centered: {
    width,
    height,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});
