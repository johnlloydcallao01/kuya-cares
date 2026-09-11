'use client';

import React from 'react';
import Link from 'next/link';

export default function PortalPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Welcome Header */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
          <h1 className="text-3xl font-bold mb-2">Welcome back, Alex Johnson!</h1>
          <p className="text-blue-100">Ready to continue your learning journey? You have 3 assignments due this week.</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Courses</p>
              <p className="text-2xl font-bold text-gray-900">6</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <i className="fa fa-book text-blue-600 text-xl"></i>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">24</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <i className="fa fa-check-circle text-green-600 text-xl"></i>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overall GPA</p>
              <p className="text-2xl font-bold text-gray-900">3.8</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <i className="fa fa-star text-yellow-600 text-xl"></i>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Study Hours</p>
              <p className="text-2xl font-bold text-gray-900">127</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <i className="fa fa-clock text-purple-600 text-xl"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Current Courses */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Current Courses</h2>
                {(Link as any)({
                  href: "/courses",
                  className: "text-blue-600 hover:text-blue-700 text-sm font-medium",
                  children: "View All"
                })}
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <i className="fa fa-exclamation-triangle text-red-600"></i>
                    </div>
                    <div className="ml-3">
                      <h3 className="font-medium text-gray-900">Data Structures Project</h3>
                      <p className="text-sm text-gray-600">Computer Science Fundamentals</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-red-600">Due Tomorrow</p>
                    <p className="text-xs text-gray-500">Not Started</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <i className="fa fa-clock text-yellow-600"></i>
                    </div>
                    <div className="ml-3">
                      <h3 className="font-medium text-gray-900">Calculus Problem Set</h3>
                      <p className="text-sm text-gray-600">Advanced Mathematics</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-yellow-600">Due Friday</p>
                    <p className="text-xs text-gray-500">In Progress</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <i className="fa fa-check text-green-600"></i>
                    </div>
                    <div className="ml-3">
                      <h3 className="font-medium text-gray-900">Lab Report #3</h3>
                      <p className="text-sm text-gray-600">Physics Laboratory</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-600">Submitted</p>
                    <p className="text-xs text-gray-500">Grade: A-</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <button className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                  <i className="fa fa-calendar text-blue-600 text-xl mb-2"></i>
                  <span className="text-sm font-medium text-gray-900">Schedule</span>
                </button>
                
                <button className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                  <i className="fa fa-graduation-cap text-green-600 text-xl mb-2"></i>
                  <span className="text-sm font-medium text-gray-900">Grades</span>
                </button>
                
                <button className="flex flex-col items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                  <i className="fa fa-users text-purple-600 text-xl mb-2"></i>
                  <span className="text-sm font-medium text-gray-900">Groups</span>
                </button>
                
                <button className="flex flex-col items-center p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors">
                  <i className="fa fa-book-open text-yellow-600 text-xl mb-2"></i>
                  <span className="text-sm font-medium text-gray-900">Library</span>
                </button>
              </div>
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Upcoming Events</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-sm font-bold text-blue-600">15</span>
                  </div>
                  <div className="ml-3">
                    <h3 className="font-medium text-gray-900">Midterm Exam</h3>
                    <p className="text-sm text-gray-600">Computer Science Fundamentals</p>
                    <p className="text-xs text-gray-500">March 15, 2024 • 2:00 PM</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-sm font-bold text-green-600">18</span>
                  </div>
                  <div className="ml-3">
                    <h3 className="font-medium text-gray-900">Study Group</h3>
                    <p className="text-sm text-gray-600">Advanced Mathematics</p>
                    <p className="text-xs text-gray-500">March 18, 2024 • 4:00 PM</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-sm font-bold text-purple-600">22</span>
                  </div>
                  <div className="ml-3">
                    <h3 className="font-medium text-gray-900">Guest Lecture</h3>
                    <p className="text-sm text-gray-600">Physics Laboratory</p>
                    <p className="text-xs text-gray-500">March 22, 2024 • 1:00 PM</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Announcements */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Announcements</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                  <h3 className="font-medium text-gray-900">Spring Break Schedule</h3>
                  <p className="text-sm text-gray-600 mt-1">Classes will resume on March 25th. Check your email for detailed information.</p>
                  <p className="text-xs text-gray-500 mt-2">2 days ago</p>
                </div>
                
                <div className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                  <h3 className="font-medium text-gray-900">Library Hours Extended</h3>
                  <p className="text-sm text-gray-600 mt-1">The library will be open 24/7 during exam week starting March 20th.</p>
                  <p className="text-xs text-gray-500 mt-2">5 days ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}