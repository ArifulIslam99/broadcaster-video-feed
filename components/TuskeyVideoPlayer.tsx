import { AVPlaybackStatus, AVPlaybackStatusSuccess, ResizeMode, Video } from 'expo-av';
import * as Network from 'expo-network';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, View } from 'react-native';

const { width, height } = Dimensions.get('window');

const API_KEY = '4c52d09a-3fdb-4972-9f9b-289d0b0e4c78';
const MAX_LOAD_TIME_MS = 3000; // 3 seconds max load time

interface Props {
  fileId: string;
  isVisible: boolean;
}

export default function TuskyVideoPlayer({ fileId, isVisible }: Props) {
  const videoRef = useRef<Video>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isReadyToPlay, setIsReadyToPlay] = useState(false);
  const [networkState, setNetworkState] = useState<string>('UNKNOWN');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadStartTime = useRef<number | null>(null);
  const loadTimeout = useRef<number | null>(null);

  // Monitor network state
  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        setNetworkState(state.type || 'UNKNOWN');
        console.log('Network state:', state);
      } catch (error) {
        console.error('Network check error:', error);
      }
    };
    checkNetwork();
  }, []);

  // Control playback
  useEffect(() => {
    if (videoRef.current) {
      if (isVisible && isReadyToPlay && !errorMessage) {
        videoRef.current.playAsync().catch((err) => {
          console.error('Play error:', err);
        });
      } else {
        videoRef.current.pauseAsync().catch((err) => {
          console.error('Pause error:', err);
        });
      }
    }
  }, [isVisible, isReadyToPlay, errorMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (loadTimeout.current) {
        clearTimeout(loadTimeout.current);
      }
    };
  }, []);

  const videoUri = `https://api.tusky.io/files/${fileId}/data`;

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={{
          uri: videoUri,
          headers: {
            'Api-Key': API_KEY,
            Range: 'bytes=0-65535', // Request first 64KB initially
          },
        }}
        resizeMode={ResizeMode.COVER}
        useNativeControls={true}
        isLooping
        shouldPlay={false}
        style={styles.video}
        onError={(error) => {
          console.error('Video error:', error, 'Timestamp:', Date.now());
          if (loadTimeout.current) {
            clearTimeout(loadTimeout.current);
          }
          setErrorMessage('Failed to load video. Please check your connection.');
          setIsBuffering(false);
        }}
        onLoadStart={() => {
          loadStartTime.current = Date.now();
          console.log('Load start:', loadStartTime.current);
          setIsBuffering(true);
          setIsReadyToPlay(false);
          loadTimeout.current = setTimeout(() => {
            console.error('Video load timeout after', MAX_LOAD_TIME_MS, 'ms');
            setErrorMessage('Video took too long to load. Please try again.');
            setIsBuffering(false);
          }, MAX_LOAD_TIME_MS);
        }}
        onLoad={(status) => {
          const loadTime = Date.now() - (loadStartTime.current || Date.now());
          const duration = (status as AVPlaybackStatusSuccess).durationMillis || 0;
          console.log('Load complete:', Date.now(), 'Duration:', duration, 'Load time (ms):', loadTime);
          setIsBuffering(false);
          setIsReadyToPlay(true);
          setErrorMessage(null);
          if (loadTimeout.current) {
            clearTimeout(loadTimeout.current);
          }
        }}
        onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
          if ('isBuffering' in status) {
            setIsBuffering(status.isBuffering);
            console.log('Buffering:', status.isBuffering, 'Timestamp:', Date.now(), 'Network:', networkState);
          }
          if ('playableDurationMillis' in status && status.playableDurationMillis) {
            console.log('Playable Duration:', status.playableDurationMillis);
            const bufferThreshold = networkState === Network.NetworkStateType.CELLULAR ? 1000 : 500;
            if (status.playableDurationMillis >= bufferThreshold) {
              setIsReadyToPlay(true);
            }
          }
          if ('error' in status && status.error) {
            console.error('Playback error:', status.error, 'Timestamp:', Date.now());
            if (loadTimeout.current) {
              clearTimeout(loadTimeout.current);
            }
            setErrorMessage('Failed to load video. Please check your connection.');
            setIsBuffering(false);
          }
        }}
        progressUpdateIntervalMillis={200} // Fast updates for quick response
      />
      {isBuffering && !errorMessage && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      )}
      {errorMessage && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width,
    height,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width,
    height,
  },
  loadingOverlay: {
    position: 'absolute',
    width,
    height,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  errorOverlay: {
    position: 'absolute',
    width,
    height,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
});