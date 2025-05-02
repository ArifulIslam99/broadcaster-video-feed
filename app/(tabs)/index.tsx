// app/index.tsx
import TuskyVideoPlayer from '@/components/TuskeyVideoPlayer';
import React, { useRef, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, View } from 'react-native';

const { height } = Dimensions.get('window');

// List of Tusky file IDs
const videoFileIds = [
  '4a6438a8-8684-457b-ab82-d37b766716d5',
  '8a807a4e-0c4e-4f70-b427-e5147cb80596',
];

export default function App() {
  const [visibleIndex, setVisibleIndex] = useState(0);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setVisibleIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 80,
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={videoFileIds}
        keyExtractor={(id) => id}
        renderItem={({ item, index }) => (
          <TuskyVideoPlayer fileId={item} isVisible={visibleIndex === index} />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToAlignment="center"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
