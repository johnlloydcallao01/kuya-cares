"use client";

import React from "react";
import Image from "@/components/ui/ImageWrapper";

/**
 * Trending page component - Shows trending content and popular videos
 */
export default function TrendingPage() {

  // Mock trending data
  const trendingCategories = [
    { id: 1, name: "Music", count: "2.3M videos", icon: "🎵" },
    { id: 2, name: "Gaming", count: "1.8M videos", icon: "🎮" },
    { id: 3, name: "Movies", count: "945K videos", icon: "🎬" },
    { id: 4, name: "News", count: "1.2M videos", icon: "📰" },
    { id: 5, name: "Sports", count: "876K videos", icon: "⚽" },
    { id: 6, name: "Technology", count: "654K videos", icon: "💻" },
  ];

  const trendingVideos = [
    {
      id: 1,
      title: "Breaking: Major Tech Announcement Changes Everything",
      channel: "Tech News Today",
      views: "2.3M views",
      time: "2 hours ago",
      thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=320&h=180&fit=crop",
      trending: "#1 on Trending"
    },
    {
      id: 2,
      title: "Viral Dance Challenge Takes Over Social Media",
      channel: "Entertainment Weekly",
      views: "1.8M views",
      time: "4 hours ago",
      thumbnail: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=320&h=180&fit=crop",
      trending: "#2 on Trending"
    },
    {
      id: 3,
      title: "Scientists Make Groundbreaking Discovery",
      channel: "Science Daily",
      views: "1.5M views",
      time: "6 hours ago",
      thumbnail: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=320&h=180&fit=crop",
      trending: "#3 on Trending"
    },
    {
      id: 4,
      title: "Epic Gaming Moments Compilation 2024",
      channel: "Gaming Central",
      views: "1.2M views",
      time: "8 hours ago",
      thumbnail: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=320&h=180&fit=crop",
      trending: "#4 on Trending"
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
          {/* Page Header */}
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Trending</h1>
            <p className="text-sm md:text-base text-gray-600">Discover what&apos;s popular and trending right now</p>
          </div>

          {/* Trending Categories */}
          <div className="mb-6 md:mb-8">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Trending Categories</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
              {trendingCategories.map((category) => (
                <div
                  key={category.id}
                  className="bg-white rounded-lg p-3 md:p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="text-xl md:text-2xl mb-2">{category.icon}</div>
                  <h3 className="font-medium text-gray-900 text-sm md:text-base">{category.name}</h3>
                  <p className="text-xs md:text-sm text-gray-500">{category.count}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Trending Content */}
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Trending Content</h2>
            <div className="space-y-4">
              {trendingVideos.map((video) => (
                <div
                  key={video.id}
                  className="bg-white rounded-lg p-3 md:p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Image
                      src={video.thumbnail}
                      alt={video.title}
                      width={192}
                      height={112}
                      className="w-full sm:w-48 h-32 sm:h-28 object-cover rounded-lg flex-shrink-0"
                    />
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 mb-1 line-clamp-2 text-sm md:text-base">
                            {video.title}
                          </h3>
                          <p className="text-xs md:text-sm text-gray-600 mb-1">{video.channel}</p>
                          <p className="text-xs md:text-sm text-gray-500">{video.views} • {video.time}</p>
                        </div>
                        <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded-full mt-2 sm:mt-0 self-start">
                          {video.trending}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Load More Button */}
          <div className="mt-6 md:mt-8 text-center">
            <button className="bg-blue-600 text-white px-4 md:px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm md:text-base">
              Load More Trending Content
            </button>
          </div>
    </div>
  );
}
