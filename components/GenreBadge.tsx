import { View, Text } from "react-native";

interface Props {
  genre: string;
}

export function GenreBadge({ genre }: Props) {
  return (
    <View className="bg-blue-100 dark:bg-blue-900 rounded-full px-3 py-1">
      <Text className="text-xs text-blue-700 dark:text-blue-300 font-medium">
        {genre}
      </Text>
    </View>
  );
}
