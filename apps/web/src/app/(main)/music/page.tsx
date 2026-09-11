"use client";

import React from "react";
import Image from "@/components/ui/ImageWrapper";

/**
 * Music page component - Shows music content, playlists, and artists
 */
export default function MusicPage() {

  // Mock music data
  const musicGenres = [
    { id: 1, name: "Pop", count: "1.2M songs", color: "bg-pink-500" },
    { id: 2, name: "Rock", count: "890K songs", color: "bg-red-500" },
    { id: 3, name: "Hip Hop", count: "756K songs", color: "bg-purple-500" },
    { id: 4, name: "Electronic", count: "634K songs", color: "bg-blue-500" },
    { id: 5, name: "Jazz", count: "423K songs", color: "bg-yellow-500" },
    { id: 6, name: "Classical", count: "312K songs", color: "bg-green-500" },
  ];

  const featuredPlaylists = [
    {
      id: 1,
      title: "Today's Top Hits",
      description: "The most played songs right now",
      songCount: 50,
      thumbnail: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
      plays: "2.3M plays"
    },
    {
      id: 2,
      title: "Chill Vibes",
      description: "Relaxing music for any time of day",
      songCount: 75,
      thumbnail: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&h=300&fit=crop",
      plays: "1.8M plays"
    },
    {
      id: 3,
      title: "Workout Motivation",
      description: "High-energy tracks to power your workout",
      songCount: 40,
      thumbnail: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=300&fit=crop",
      plays: "1.5M plays"
    },
    {
      id: 4,
      title: "Indie Discoveries",
      description: "Fresh indie tracks you need to hear",
      songCount: 60,
      thumbnail: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
      plays: "945K plays"
    },
  ];

  const trendingArtists = [
    {
      id: 1,
      name: "Luna Rodriguez",
      genre: "Pop",
      followers: "2.3M",
      avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
      verified: true
    },
    {
      id: 2,
      name: "The Midnight Echo",
      genre: "Indie Rock",
      followers: "1.8M",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      verified: true
    },
    {
      id: 3,
      name: "DJ Synthwave",
      genre: "Electronic",
      followers: "1.2M",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
      verified: false
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
          {/* Page Header */}
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Music</h1>
            <p className="text-sm md:text-base text-gray-600">Discover new music, artists, and playlists</p>
          </div>

          {/* Music Genres */}
          <div className="mb-6 md:mb-8">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Browse by Genre</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
              {musicGenres.map((genre) => (
                <div
                  key={genre.id}
                  className={`${genre.color} rounded-lg p-3 md:p-4 text-white cursor-pointer hover:opacity-90 transition-opacity`}
                >
                  <h3 className="font-medium text-base md:text-lg">{genre.name}</h3>
                  <p className="text-xs md:text-sm opacity-90">{genre.count}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Featured Playlists */}
          <div className="mb-6 md:mb-8">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Featured Playlists</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {featuredPlaylists.map((playlist) => (
                <div
                  key={playlist.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <Image
                    src={playlist.thumbnail}
                    alt={playlist.title}
                    width={300}
                    height={192}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                  <div className="p-3 md:p-4">
                    <h3 className="font-medium text-gray-900 mb-1 text-sm md:text-base">{playlist.title}</h3>
                    <p className="text-xs md:text-sm text-gray-600 mb-2">{playlist.description}</p>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{playlist.songCount} songs</span>
                      <span>{playlist.plays}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trending Artists */}
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Trending Artists</h2>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
              <div className="space-y-4">
                {trendingArtists.map((artist) => (
                  <div
                    key={artist.id}
                    className="flex items-center justify-between p-3 md:p-4 hover:bg-gray-50 rounded-lg cursor-pointer"
                  >
                    <div className="flex items-center gap-3 md:gap-4">
                      <Image
                        src={artist.avatar}
                        alt={artist.name}
                        width={48}
                        height={48}
                        className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 text-sm md:text-base">{artist.name}</h3>
                          {artist.verified && (
                            <span className="text-blue-500">✓</span>
                          )}
                        </div>
                        <p className="text-xs md:text-sm text-gray-600">{artist.genre}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs md:text-sm font-medium text-gray-900">{artist.followers}</p>
                      <p className="text-xs text-gray-500">followers</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
    </div>
  );
}
