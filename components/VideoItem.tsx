import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { WebView } from 'react-native-webview';

const { width } = Dimensions.get('window');
const height = (16 / 9) * width;

interface VideoItemProps {
  uri: string;
  isVisible: boolean;
}

function VideoItem({ uri, isVisible }: VideoItemProps) {
  const [isBuffering, setIsBuffering] = useState(true);
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  const isYouTubeUrl = uri.includes('youtube.com') || uri.includes('youtu.be');

  const handleLoadStart = () => setIsBuffering(true);
  const handleLoadEnd = () => setIsBuffering(false);

  const handleStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      setIsBuffering(true); // show buffering indicator when not loaded
      return;
    }
    setIsBuffering(!status.isPlaying && !status.didJustFinish);
  };

  const handleTap = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        videoRef.current.playAsync();
        setIsPlaying(true);
      }
    }
  };

  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={styles.videoContainer}>
        {isBuffering && (
          <ActivityIndicator size="large" color="#fff" style={StyleSheet.absoluteFillObject} />
        )}
        {isYouTubeUrl ? (
          <WebView
            source={{ uri }}
            style={styles.webview}
            javaScriptEnabled={true}
            onLoadStart={handleLoadStart}
            onLoadEnd={handleLoadEnd}
            allowsInlineMediaPlayback={true}
          />
        ) : (
          <Video
            ref={videoRef}
            source={{ uri }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isVisible}
            isLooping
            onPlaybackStatusUpdate={handleStatusUpdate}
          />
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  videoContainer: {
    width: '100%',
    height,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  webview: {
    width: '100%',
    height: '100%',
  },
});

export default VideoItem;
