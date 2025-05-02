import React from 'react';
import { ScrollView } from 'react-native';
import TuskyUpload from "../../components/VideoUploadScreen";

export default function ExploreScreen() {
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20 }}>
      <TuskyUpload />
    </ScrollView>
  );
}
