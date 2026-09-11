import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, ScrollView, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '../../navigation/NavigationContext';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
// import { useThemeColors } from '../../contexts/ThemeContext';

const LoginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof LoginSchema>;

export default function LoginScreen() {
  const navigation = useNavigation();
  const { login, isLoading, error, clearError } = useAuth();
  // const colors = useThemeColors();
  const [showPassword, setShowPassword] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      clearError();
      await login(data);
      // Navigation is handled by AppNavigator listening to auth state
    } catch {
      // Error is handled by context state
    }
  };

  return (
    <ImageBackground
      source={{ uri: 'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg' }}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <View className="flex-1 bg-white/90">
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}
              keyboardShouldPersistTaps="handled"
            >

              {/* Header / Logo Area */}
              <View className="items-center mb-8">
                <View className="w-20 h-20 bg-gray-100 rounded-2xl items-center justify-center mb-4">
                  <Image
                    source={require('../../../assets/logo.png')}
                    style={{ width: 60, height: 60 }}
                    resizeMode="contain"
                  />
                </View>
                <Text className="text-3xl font-bold text-gray-900 mb-1">Tap2Go</Text>
                <Text className="text-[#eba336] text-base">Food Delivery from Laguna</Text>
              </View>

              {/* Form */}
              <View className="space-y-4">
                {error && (
                  <View className="bg-red-50 p-3 rounded-lg mb-4 border border-red-100">
                    <Text className="text-red-600 text-sm">{error}</Text>
                  </View>
                )}

                <View>
                  <Text className="text-gray-700 font-medium mb-1">Email</Text>
                  <Controller
                    control={control}
                    name="email"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                        placeholder="Enter your email"
                        placeholderTextColor="#9CA3AF"
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoCorrect={false}
                        autoComplete="email"
                        textContentType="emailAddress"
                        importantForAutofill="yes"
                      />
                    )}
                  />
                  {errors.email && (
                    <Text className="text-red-500 text-xs mt-1">{errors.email.message}</Text>
                  )}
                </View>

                <View>
                  <Text className="text-gray-700 font-medium mb-1">Password</Text>
                  <View className="relative">
                    <Controller
                      control={control}
                      name="password"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 pr-12"
                          placeholder="Enter your password"
                          placeholderTextColor="#9CA3AF"
                          onBlur={onBlur}
                          onChangeText={onChange}
                          value={value}
                          secureTextEntry={!showPassword}
                          autoCorrect={false}
                          autoComplete="current-password"
                          textContentType="password"
                          importantForAutofill="yes"
                          returnKeyType="go"
                          onSubmitEditing={handleSubmit(onSubmit)}
                        />
                      )}
                    />
                    <TouchableOpacity
                      className="absolute right-4 top-3.5"
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#6B7280"
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.password && (
                    <Text className="text-red-500 text-xs mt-1">{errors.password.message}</Text>
                  )}
                </View>

                <TouchableOpacity
                  className="items-end"
                  onPress={() => navigation.navigate('ForgotPassword')}
                >
                  <Text className="text-[#eba336] font-medium">Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`w-full bg-[#eba336] rounded-xl py-4 items-center mt-4 ${isLoading ? 'opacity-70' : ''}`}
                  onPress={handleSubmit(onSubmit)}
                  disabled={isLoading}
                >
                  <Text className="text-white font-bold text-lg">
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Footer */}
              <View className="flex-row justify-center mt-8">
                <Text className="text-gray-500">Don&apos;t have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                  <Text className="text-[#eba336] font-bold">Sign Up</Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}
