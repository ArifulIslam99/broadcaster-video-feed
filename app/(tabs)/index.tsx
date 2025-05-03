import TuskyVideoPlayer from '@/components/TuskeyVideoPlayer';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, RefreshControl, StyleSheet, View } from 'react-native'; // ✅ Added RefreshControl
import fetchOnChainFileIds from '../get_id';

const { height } = Dimensions.get('window');

export default function App() {
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false); // ✅ Added

  const fetchAndSync = async () => {
    const onChainIds = await fetchOnChainFileIds();
    setFileIds(onChainIds);
  };

  useEffect(() => {
    fetchAndSync(); // ✅ Load on mount
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAndSync();
    setRefreshing(false);
  }, []);

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
        data={fileIds}
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
        refreshControl={ // ✅ Pull-to-refresh handler
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="white" />
        }
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
