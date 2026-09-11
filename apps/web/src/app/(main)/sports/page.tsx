"use client";

import React from "react";
import Image from "@/components/ui/ImageWrapper";

/**
 * Sports page component - Shows sports news, scores, and highlights
 */
export default function SportsPage() {

  // Mock sports data
  const sportsCategories = [
    { id: 1, name: "Football", icon: "🏈", games: "24 games today" },
    { id: 2, name: "Basketball", icon: "🏀", games: "18 games today" },
    { id: 3, name: "Soccer", icon: "⚽", games: "32 matches today" },
    { id: 4, name: "Baseball", icon: "⚾", games: "15 games today" },
    { id: 5, name: "Tennis", icon: "🎾", games: "12 matches today" },
    { id: 6, name: "Hockey", icon: "🏒", games: "8 games today" },
  ];

  const liveGames = [
    {
      id: 1,
      homeTeam: "Lakers",
      awayTeam: "Warriors",
      homeScore: 98,
      awayScore: 102,
      quarter: "Q4 2:34",
      sport: "Basketball",
      isLive: true
    },
    {
      id: 2,
      homeTeam: "Patriots",
      awayTeam: "Chiefs",
      homeScore: 21,
      awayScore: 14,
      quarter: "Q3 8:45",
      sport: "Football",
      isLive: true
    },
    {
      id: 3,
      homeTeam: "Real Madrid",
      awayTeam: "Barcelona",
      homeScore: 1,
      awayScore: 2,
      quarter: "75'",
      sport: "Soccer",
      isLive: true
    },
  ];

  const highlights = [
    {
      id: 1,
      title: "Incredible Last-Second Touchdown Wins Championship",
      sport: "Football",
      views: "2.3M views",
      time: "2 hours ago",
      thumbnail: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=320&h=180&fit=crop",
      duration: "3:45"
    },
    {
      id: 2,
      title: "Amazing Triple-Double Performance Highlights",
      sport: "Basketball",
      views: "1.8M views",
      time: "4 hours ago",
      thumbnail: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=320&h=180&fit=crop",
      duration: "5:12"
    },
    {
      id: 3,
      title: "World Cup Qualifier: Best Goals Compilation",
      sport: "Soccer",
      views: "3.1M views",
      time: "6 hours ago",
      thumbnail: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=320&h=180&fit=crop",
      duration: "8:30"
    },
    {
      id: 4,
      title: "Perfect Game: Historic Baseball Moment",
      sport: "Baseball",
      views: "945K views",
      time: "8 hours ago",
      thumbnail: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=320&h=180&fit=crop",
      duration: "4:22"
    },
  ];

  const upcomingGames = [
    {
      id: 1,
      homeTeam: "Celtics",
      awayTeam: "Heat",
      date: "Today",
      time: "8:00 PM",
      sport: "Basketball",
      channel: "ESPN"
    },
    {
      id: 2,
      homeTeam: "Cowboys",
      awayTeam: "Giants",
      date: "Tomorrow",
      time: "1:00 PM",
      sport: "Football",
      channel: "FOX"
    },
    {
      id: 3,
      homeTeam: "Manchester United",
      awayTeam: "Liverpool",
      date: "Sunday",
      time: "11:30 AM",
      sport: "Soccer",
      channel: "NBC"
    },
  ];

  const standings = [
    { rank: 1, team: "Golden State Warriors", wins: 45, losses: 12, pct: ".789" },
    { rank: 2, team: "Boston Celtics", wins: 42, losses: 15, pct: ".737" },
    { rank: 3, team: "Milwaukee Bucks", wins: 40, losses: 17, pct: ".702" },
    { rank: 4, team: "Philadelphia 76ers", wins: 38, losses: 19, pct: ".667" },
    { rank: 5, team: "Miami Heat", wins: 35, losses: 22, pct: ".614" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
          {/* Page Header */}
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Sports</h1>
            <p className="text-sm md:text-base text-gray-600">Live scores, highlights, and sports news</p>
          </div>

          {/* Sports Categories */}
          <div className="mb-6 md:mb-8">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Sports Categories</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
              {sportsCategories.map((category) => (
                <div
                  key={category.id}
                  className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer text-center"
                >
                  <div className="text-3xl mb-2">{category.icon}</div>
                  <h3 className="font-medium text-gray-900 mb-1">{category.name}</h3>
                  <p className="text-xs text-gray-500">{category.games}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Live Games */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Live Games</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveGames.map((game) => (
                <div
                  key={game.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
                      LIVE
                    </span>
                    <span className="text-sm text-gray-600">{game.sport}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{game.awayTeam}</span>
                      <span className="text-xl font-bold">{game.awayScore}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{game.homeTeam}</span>
                      <span className="text-xl font-bold">{game.homeScore}</span>
                    </div>
                  </div>
                  <div className="text-center mt-3 text-sm text-gray-600">
                    {game.quarter}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Highlights and Upcoming Games */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Highlights */}
            <div className="lg:col-span-2">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Top Highlights</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {highlights.map((highlight) => (
                  <div
                    key={highlight.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="relative">
                      <Image
                        src={highlight.thumbnail}
                        alt={highlight.title}
                        width={400}
                        height={160}
                        className="w-full h-40 object-cover rounded-t-lg"
                      />
                      <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                        {highlight.duration}
                      </div>
                    </div>
                    <div className="p-4">
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded mb-2 inline-block">
                        {highlight.sport}
                      </span>
                      <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">{highlight.title}</h3>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{highlight.views}</span>
                        <span>{highlight.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sidebar Content */}
            <div className="space-y-6">
              {/* Upcoming Games */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Upcoming Games</h2>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="space-y-4">
                    {upcomingGames.map((game) => (
                      <div key={game.id} className="border-b border-gray-100 last:border-b-0 pb-3 last:pb-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">
                              {game.awayTeam} @ {game.homeTeam}
                            </p>
                            <p className="text-xs text-gray-600">{game.sport}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">{game.date}</p>
                            <p className="text-xs text-gray-600">{game.time}</p>
                            <p className="text-xs text-blue-600">{game.channel}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Standings */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">NBA Standings</h2>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="space-y-2">
                    {standings.map((team) => (
                      <div key={team.rank} className="flex justify-between items-center py-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-gray-400 w-4">{team.rank}</span>
                          <span className="text-sm font-medium text-gray-900">{team.team}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-gray-600">{team.wins}-{team.losses}</span>
                          <span className="text-xs text-gray-500 ml-2">{team.pct}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
    </div>
  );
}
