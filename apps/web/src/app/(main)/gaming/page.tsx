"use client";

import React from "react";
import Image from "@/components/ui/ImageWrapper";

/**
 * Gaming page component - Shows gaming content, streams, and tournaments
 */
export default function GamingPage() {

  // Mock gaming data
  const gameCategories = [
    { id: 1, name: "Action", count: "2.1M videos", icon: "⚔️" },
    { id: 2, name: "Strategy", count: "1.5M videos", icon: "🧠" },
    { id: 3, name: "RPG", count: "1.8M videos", icon: "🗡️" },
    { id: 4, name: "Sports", count: "945K videos", icon: "🏈" },
    { id: 5, name: "Racing", count: "756K videos", icon: "🏎️" },
    { id: 6, name: "Indie", count: "634K videos", icon: "🎮" },
  ];

  const liveStreams = [
    {
      id: 1,
      title: "Epic Boss Battle - Dark Souls III",
      streamer: "ProGamer_Mike",
      game: "Dark Souls III",
      viewers: "12.3K",
      thumbnail: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=320&h=180&fit=crop",
      isLive: true
    },
    {
      id: 2,
      title: "Building the Ultimate City",
      streamer: "CityBuilder_Sarah",
      game: "Cities: Skylines",
      viewers: "8.7K",
      thumbnail: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=320&h=180&fit=crop",
      isLive: true
    },
    {
      id: 3,
      title: "Competitive Ranked Match",
      streamer: "ESports_Champion",
      game: "League of Legends",
      viewers: "15.2K",
      thumbnail: "https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=320&h=180&fit=crop",
      isLive: true
    },
  ];

  const popularGames = [
    {
      id: 1,
      title: "Cyberpunk 2077",
      category: "RPG",
      rating: 4.2,
      players: "2.3M",
      thumbnail: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=200&h=300&fit=crop"
    },
    {
      id: 2,
      title: "Minecraft",
      category: "Sandbox",
      rating: 4.8,
      players: "5.1M",
      thumbnail: "https://images.unsplash.com/photo-1606092195730-5d7b9af1efc5?w=200&h=300&fit=crop"
    },
    {
      id: 3,
      title: "Fortnite",
      category: "Battle Royale",
      rating: 4.1,
      players: "3.8M",
      thumbnail: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200&h=300&fit=crop"
    },
    {
      id: 4,
      title: "Among Us",
      category: "Social Deduction",
      rating: 4.5,
      players: "1.9M",
      thumbnail: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=200&h=300&fit=crop"
    },
  ];

  const upcomingTournaments = [
    {
      id: 1,
      name: "World Championship 2024",
      game: "League of Legends",
      prize: "$2.5M",
      date: "March 15, 2024",
      participants: "64 teams"
    },
    {
      id: 2,
      name: "Global Invitational",
      game: "Counter-Strike 2",
      prize: "$1.8M",
      date: "April 2, 2024",
      participants: "32 teams"
    },
    {
      id: 3,
      name: "Battle Royale Masters",
      game: "Fortnite",
      prize: "$1.2M",
      date: "April 20, 2024",
      participants: "100 players"
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
          {/* Page Header */}
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Gaming</h1>
            <p className="text-sm md:text-base text-gray-600">Discover games, watch streams, and join tournaments</p>
          </div>

          {/* Game Categories */}
          <div className="mb-6 md:mb-8">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Browse by Category</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
              {gameCategories.map((category) => (
                <div
                  key={category.id}
                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="text-2xl mb-2">{category.icon}</div>
                  <h3 className="font-medium text-gray-900">{category.name}</h3>
                  <p className="text-sm text-gray-500">{category.count}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Live Streams */}
          <div className="mb-6 md:mb-8">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Live Streams</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {liveStreams.map((stream) => (
                <div
                  key={stream.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="relative">
                    {/* @ts-ignore */}
                    <Image
                      src={stream.thumbnail}
                      alt={stream.title}
                      width={320}
                      height={160}
                      className="w-full h-40 object-cover rounded-t-lg"
                    />
                    <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                      LIVE
                    </div>
                    <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                      {stream.viewers} viewers
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-gray-900 mb-1 line-clamp-2">{stream.title}</h3>
                    <p className="text-sm text-gray-600 mb-1">{stream.streamer}</p>
                    <p className="text-sm text-gray-500">{stream.game}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Popular Games and Tournaments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Popular Games */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Popular Games</h2>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="grid grid-cols-2 gap-4">
                  {popularGames.map((game) => (
                    <div
                      key={game.id}
                      className="cursor-pointer hover:bg-gray-50 p-3 rounded-lg"
                    >
                      <Image
                        src={game.thumbnail}
                        alt={game.title}
                        width={160}
                        height={128}
                        className="w-full h-32 object-cover rounded-lg mb-2"
                      />
                      <h3 className="font-medium text-gray-900 text-sm mb-1">{game.title}</h3>
                      <p className="text-xs text-gray-600 mb-1">{game.category}</p>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>⭐ {game.rating}</span>
                        <span>{game.players} players</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Upcoming Tournaments */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Upcoming Tournaments</h2>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="space-y-4">
                  {upcomingTournaments.map((tournament) => (
                    <div
                      key={tournament.id}
                      className="border-l-4 border-blue-500 pl-4 py-2"
                    >
                      <h3 className="font-medium text-gray-900">{tournament.name}</h3>
                      <p className="text-sm text-gray-600 mb-1">{tournament.game}</p>
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>{tournament.date}</span>
                        <span className="font-medium text-green-600">{tournament.prize}</span>
                      </div>
                      <p className="text-xs text-gray-500">{tournament.participants}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
    </div>
  );
}
