import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';

// Temporary type until shared-types is working
interface Category {
  id: string;
  name: string;
}

interface CategoryFilterProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export default function CategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory
}: CategoryFilterProps) {
  return (
    <View className="bg-white border-b border-gray-200">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-4 py-4"
        contentContainerStyle={{ paddingRight: 16 }}
      >
        <TouchableOpacity
          onPress={() => onSelectCategory('')}
          className={`mr-3 px-4 py-2 rounded-full border ${
            selectedCategory === ''
              ? 'bg-orange-500 border-orange-500'
              : 'bg-white border-gray-300'
          }`}
        >
          <Text className={`font-medium ${
            selectedCategory === '' ? 'text-white' : 'text-gray-700'
          }`}>
            All
          </Text>
        </TouchableOpacity>

        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            onPress={() => onSelectCategory(category.name)}
            className={`mr-3 px-4 py-2 rounded-full border ${
              selectedCategory === category.name
                ? 'bg-orange-500 border-orange-500'
                : 'bg-white border-gray-300'
            }`}
          >
            <Text className={`font-medium ${
              selectedCategory === category.name ? 'text-white' : 'text-gray-700'
            }`}>
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
