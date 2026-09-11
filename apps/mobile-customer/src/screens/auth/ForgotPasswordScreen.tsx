import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '../../navigation/NavigationContext';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthService } from '@encreasl/client-services';
import { Ionicons } from '@expo/vector-icons';

const ForgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
});

type ForgotPasswordFormData = z.infer<typeof ForgotPasswordSchema>;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setIsLoading(true);
      setError(null);
      await AuthService.forgotPassword(data.email);
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request password reset');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <ImageBackground
        source={{ uri: 'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg' }}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        <View className="flex-1 bg-white/90">
          <SafeAreaView style={{ flex: 1 }}>
            <View className="flex-1 px-6 justify-center items-center">
              <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-6">
                <Ionicons name="mail-open-outline" size={40} color="#16A34A" />
              </View>
              <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">Check your email</Text>
              <Text className="text-gray-500 text-center mb-8">
                We have sent password reset instructions to your email address.
              </Text>
              <TouchableOpacity
                className="w-full bg-[#eba336] rounded-xl py-4 items-center"
                onPress={() => navigation.navigate('Login')}
              >
                <Text className="text-white font-bold text-lg">Back to Login</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </ImageBackground>
    );
  }

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
            <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }}>

              <TouchableOpacity
                className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 mb-8"
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={24} color="#374151" />
              </TouchableOpacity>

              <View className="mb-8">
                <Text className="text-3xl font-bold text-gray-900 mb-2">Forgot Password?</Text>
                <Text className="text-gray-500 text-base">
                  Don&apos;t worry! It happens. Please enter the email associated with your account.
                </Text>
              </View>

              <View className="space-y-4">
                {error && (
                  <View className="bg-red-50 p-3 rounded-lg mb-4 border border-red-100">
                    <Text className="text-red-600 text-sm">{error}</Text>
                  </View>
                )}

                <View>
                  <Text className="text-gray-700 font-medium mb-1">Email Address</Text>
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
                      />
                    )}
                  />
                  {errors.email && (
                    <Text className="text-red-500 text-xs mt-1">{errors.email.message}</Text>
                  )}
                </View>

                <TouchableOpacity
                  className={`w-full bg-[#eba336] rounded-xl py-4 items-center mt-4 ${isLoading ? 'opacity-70' : ''}`}
                  onPress={handleSubmit(onSubmit)}
                  disabled={isLoading}
                >
                  <Text className="text-white font-bold text-lg">
                    {isLoading ? 'Sending...' : 'Send Code'}
                  </Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}
