import { API_KEY } from '@/config';
import { AVPlaybackStatus, AVPlaybackStatusSuccess, ResizeMode, Video } from 'expo-av';
import * as Network from 'expo-network';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, View } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MAX_LOAD_TIME_MS = 5000; // 5s timeout before retry
const CHUNK_SIZE = 65536; // 64KB

interface Props {
  fileId: string;
  isVisible: boolean;
}

export default function TuskyVideoPlayer({ fileId, isVisible }: Props) {
  const videoRef = useRef<Video>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isReadyToPlay, setIsReadyToPlay] = useState(false);
  const [networkState, setNetworkState] = useState<string>('UNKNOWN');
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const loadStartTime = useRef<number | null>(null);
  const loadTimeout = useRef<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Monitor network state
  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        setNetworkState(state.type || 'UNKNOWN');
        console.log('Network state:', state);
      } catch (error) {
        console.error('Network check error:', JSON.stringify(error, null, 2));
      }
    };
    checkNetwork();
  }, []);

  // Control playback
  useEffect(() => {
    if (!videoRef.current) return;

    if (isVisible && isReadyToPlay) {
      videoRef.current.playAsync().catch((err) => {
        console.error('Play error:', JSON.stringify(err, null, 2));
      });
    } else {
      videoRef.current.pauseAsync().catch((err) => {
        console.error('Pause error:', JSON.stringify(err, null, 2));
      });
    }
  }, [isVisible, isReadyToPlay]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (loadTimeout.current) {
        clearTimeout(loadTimeout.current);
      }
    };
  }, []);

  // Retry logic
  const scheduleRetry = () => {
    setRetryCount((prev) => {
      const newCount = prev + 1;
      console.log(`Retrying video load for fileId ${fileId} (attempt ${newCount})`);
      return newCount;
    });
    setIsBuffering(true);
    setIsReadyToPlay(false);
    // Reload video
    if (videoRef.current) {
      videoRef.current.unloadAsync().then(() => {
        videoRef.current?.loadAsync({
          uri: videoUri,
          headers: {
            'Api-Key': API_KEY,
            Range: `bytes=0-${CHUNK_SIZE - 1}`,
          },
        }).catch((err) => {
          console.error('Reload error:', JSON.stringify(err, null, 2));
          scheduleRetry();
        });
      }).catch((err) => {
        console.error('Unload error:', JSON.stringify(err, null, 2));
        scheduleRetry();
      });
    }
  };

  const videoUri = `https://api.tusky.io/files/${fileId}/data`;

  // Calculate video styles
  const getVideoStyles = () => {
    if (!videoDimensions) {
      return styles.video;
    }

    const { width: videoWidth, height: videoHeight } = videoDimensions;
    const isVertical = videoHeight > videoWidth;

    if (isVertical) {
      return styles.video;
    } else {
      const aspectRatio = videoWidth / videoHeight;
      const scaledHeight = SCREEN_WIDTH / aspectRatio;
      return [
        styles.video,
        {
          width: SCREEN_WIDTH,
          height: scaledHeight,
        },
      ];
    }
  };

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={{
          uri: videoUri,
          headers: {
            'Api-Key': API_KEY,
            Range: `bytes=0-${CHUNK_SIZE - 1}`, // First 64KB
          },
        }}
        resizeMode={ResizeMode.CONTAIN}
        useNativeControls={true}
        isLooping
        shouldPlay={false}
        style={getVideoStyles()}
        onError={(error) => {
          console.error('Video error:', JSON.stringify(error, null, 2), 'Timestamp:', Date.now());
          if (loadTimeout.current) {
            clearTimeout(loadTimeout.current);
          }
          scheduleRetry();
        }}
        onLoadStart={() => {
          loadStartTime.current = Date.now();
          console.log('Load start:', loadStartTime.current);
          setIsBuffering(true);
          setIsReadyToPlay(false);
          loadTimeout.current = setTimeout(() => {
            console.log(`Video load timeout after ${MAX_LOAD_TIME_MS} ms`);
            scheduleRetry();
          }, MAX_LOAD_TIME_MS);
        }}
        onLoad={(status) => {
          const loadTime = Date.now() - (loadStartTime.current || Date.now());
          const duration = (status as AVPlaybackStatusSuccess).durationMillis || 0;
          // Fix TypeScript: Use videoWidth and videoHeight
          const width = (status as any).videoWidth || SCREEN_WIDTH;
          const height = (status as any).videoHeight || SCREEN_HEIGHT;
          console.log('Load complete:', Date.now(), 'Duration:', duration, 'Load time (ms):', loadTime);
          console.log('Video dimensions:', { width, height });
          setVideoDimensions({
            width,
            height,
          });
          setIsReadyToPlay(true);
          if (loadTimeout.current) {
            clearTimeout(loadTimeout.current);
          }
        }}
        onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
          if ('isPlaying' in status && status.isPlaying) {
            setIsBuffering(false); // Hide spinner when playing
            console.log('Playing:', true, 'Timestamp:', Date.now(), 'Network:', networkState);
          } else if ('isBuffering' in status && status.isBuffering) {
            setIsBuffering(true);
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
            scheduleRetry();
          }
        }}
        progressUpdateIntervalMillis={100} // Faster updates
      />
      {isBuffering && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingOverlay: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});