"use client";

import React from "react";
import Image from "@/components/ui/ImageWrapper";

/**
 * News page component - Shows latest news articles and breaking news
 */
export default function NewsPage() {

  // Mock news data
  const newsCategories = [
    { id: 1, name: "Breaking", count: "234 articles", color: "bg-red-500" },
    { id: 2, name: "Technology", count: "1.2K articles", color: "bg-blue-500" },
    { id: 3, name: "Business", count: "890 articles", color: "bg-green-500" },
    { id: 4, name: "Sports", count: "756 articles", color: "bg-orange-500" },
    { id: 5, name: "Health", count: "634 articles", color: "bg-purple-500" },
    { id: 6, name: "Science", count: "423 articles", color: "bg-indigo-500" },
  ];

  const breakingNews = [
    {
      id: 1,
      title: "Major Economic Summit Concludes with Historic Agreement",
      summary: "World leaders reach consensus on climate action and trade policies",
      source: "Global News Network",
      time: "15 minutes ago",
      thumbnail: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&h=250&fit=crop",
      category: "Politics",
      isBreaking: true
    },
    {
      id: 2,
      title: "Breakthrough in Renewable Energy Technology Announced",
      summary: "New solar panel efficiency reaches unprecedented 45% conversion rate",
      source: "Tech Today",
      time: "1 hour ago",
      thumbnail: "https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=400&h=250&fit=crop",
      category: "Technology",
      isBreaking: false
    },
    {
      id: 3,
      title: "Global Markets React to Federal Reserve Decision",
      summary: "Interest rate changes impact international trading patterns",
      source: "Financial Times",
      time: "2 hours ago",
      thumbnail: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=250&fit=crop",
      category: "Business",
      isBreaking: false
    },
  ];

  const topStories = [
    {
      id: 1,
      title: "Scientists Discover New Species in Deep Ocean Expedition",
      summary: "Marine biologists identify previously unknown creatures in Pacific trench",
      source: "Science Daily",
      time: "3 hours ago",
      thumbnail: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=300&h=200&fit=crop",
      category: "Science",
      readTime: "4 min read"
    },
    {
      id: 2,
      title: "Championship Finals Draw Record Television Audience",
      summary: "Sports viewership reaches all-time high for season finale",
      source: "Sports Network",
      time: "4 hours ago",
      thumbnail: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=300&h=200&fit=crop",
      category: "Sports",
      readTime: "3 min read"
    },
    {
      id: 3,
      title: "New Health Guidelines Released by Medical Association",
      summary: "Updated recommendations for preventive care and wellness",
      source: "Health News",
      time: "5 hours ago",
      thumbnail: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=300&h=200&fit=crop",
      category: "Health",
      readTime: "5 min read"
    },
    {
      id: 4,
      title: "Tech Giant Announces Revolutionary AI Development",
      summary: "New artificial intelligence system shows unprecedented capabilities",
      source: "Innovation Report",
      time: "6 hours ago",
      thumbnail: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=300&h=200&fit=crop",
      category: "Technology",
      readTime: "6 min read"
    },
  ];

  const trendingTopics = [
    { id: 1, topic: "Climate Summit", articles: 45 },
    { id: 2, topic: "AI Innovation", articles: 38 },
    { id: 3, topic: "Space Exploration", articles: 29 },
    { id: 4, topic: "Economic Policy", articles: 24 },
    { id: 5, topic: "Health Research", articles: 19 },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
          {/* Page Header */}
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">News</h1>
            <p className="text-sm md:text-base text-gray-600">Stay updated with the latest news and breaking stories</p>
          </div>

          {/* News Categories */}
          <div className="mb-6 md:mb-8">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Browse by Category</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
              {newsCategories.map((category) => (
                <div
                  key={category.id}
                  className={`${category.color} rounded-lg p-4 text-white cursor-pointer hover:opacity-90 transition-opacity`}
                >
                  <h3 className="font-medium text-lg">{category.name}</h3>
                  <p className="text-sm opacity-90">{category.count}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Breaking News */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Breaking News</h2>
            <div className="space-y-4">
              {breakingNews.map((article) => (
                <div
                  key={article.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex gap-4 p-4">
                    <Image
                      src={article.thumbnail}
                      alt={article.title}
                      width={128}
                      height={80}
                      className="w-32 h-20 object-cover rounded-lg flex-shrink-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          {article.isBreaking && (
                            <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded mb-2 inline-block">
                              BREAKING
                            </span>
                          )}
                          <h3 className="font-medium text-gray-900 mb-1 line-clamp-2">
                            {article.title}
                          </h3>
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{article.summary}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{article.source}</span>
                            <span>•</span>
                            <span>{article.time}</span>
                            <span>•</span>
                            <span className="bg-gray-100 px-2 py-1 rounded">{article.category}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Stories and Trending */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Top Stories */}
            <div className="lg:col-span-2">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Top Stories</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {topStories.map((story) => (
                  <div
                    key={story.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <Image
                      src={story.thumbnail}
                      alt={story.title}
                      width={400}
                      height={160}
                      className="w-full h-40 object-cover rounded-t-lg"
                    />
                    <div className="p-4">
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded mb-2 inline-block">
                        {story.category}
                      </span>
                      <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">{story.title}</h3>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{story.summary}</p>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{story.source} • {story.time}</span>
                        <span>{story.readTime}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trending Topics */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Trending Topics</h2>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="space-y-4">
                  {trendingTopics.map((topic, index) => (
                    <div
                      key={topic.id}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                        <span className="font-medium text-gray-900">{topic.topic}</span>
                      </div>
                      <span className="text-sm text-gray-500">{topic.articles} articles</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
  );
}
