import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '../../navigation/NavigationContext';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';

// ========================================
// SIMPLE REGISTRATION SCHEMA (matches web)
// ========================================

const SimpleRegistrationSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name too long'),
  middleName: z
    .string()
    .max(100, 'Middle name too long')
    .optional(),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name too long'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the terms',
  }),
});

type SimpleRegistrationData = z.infer<typeof SimpleRegistrationSchema>;

// ========================================
// HELPER COMPONENTS
// ========================================

const FormLabel = ({ children, required }: { children: React.ReactNode, required?: boolean }) => (
  <Text className="text-gray-700 font-medium mb-1 text-sm">
    {children} {required && <Text className="text-red-500">*</Text>}
  </Text>
);

const ErrorMessage = ({ message }: { message?: string }) => {
  if (!message) return null;
  return <Text className="text-red-500 text-xs mt-1">{message}</Text>;
};

const SectionHeader = ({ title, icon }: { title: string, icon: any }) => (
  <View className="flex-row items-center mb-4 mt-6 border-b border-gray-100 pb-2">
    <View className="w-8 h-8 bg-[#eba336]/10 rounded-full items-center justify-center mr-3">
      <Ionicons name={icon} size={18} color="#eba336" />
    </View>
    <Text className="text-lg font-bold text-gray-800">{title}</Text>
  </View>
);

// ========================================
// MAIN COMPONENT
// ========================================

export default function SignupScreen() {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const { control, handleSubmit, formState: { errors } } = useForm<SimpleRegistrationData>({
    resolver: zodResolver(SimpleRegistrationSchema),
    defaultValues: {
      firstName: '',
      middleName: '',
      lastName: '',
      email: '',
      password: '',
      agreeToTerms: undefined as any,
    },
  });

  const onSubmit = async (data: SimpleRegistrationData) => {
    try {
      setIsLoading(true);
      setGeneralError(null);

      // Derive username from email (same as web)
      const derivedUsername = data.email.split('@')[0];

      const payload = {
        firstName: data.firstName.trim(),
        middleName: data.middleName?.trim() || '',
        lastName: data.lastName.trim(),
        email: data.email,
        username: derivedUsername,
        password: data.password,
        agreeToTerms: data.agreeToTerms,
      };

      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';
      const response = await fetch(`${API_URL}/customer-register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const responseText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          throw new Error('Registration failed. Please try again.');
        }

        let errorMessage = 'Registration failed. Please try again.';
        if (errorData?.type === 'duplicate') {
          errorMessage = errorData.message || `This information is already registered.`;
        } else if (errorData?.type === 'validation') {
          errorMessage = errorData.message || 'Please check your form data and try again.';
        } else if (errorData?.type === 'server_error') {
          errorMessage = errorData.message || 'We encountered a server error. Please try again.';
        } else {
          errorMessage = errorData?.error || errorData?.message || 'Registration failed.';
        }
        throw new Error(errorMessage);
      }

      Alert.alert(
        "Registration Successful",
        "Your account has been created. Please log in.",
        [{ text: "OK", onPress: () => navigation.navigate('Login') }]
      );

    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
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
            <View className="flex-row items-center p-4 border-b border-gray-100">
              <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
                <Ionicons name="arrow-back" size={24} color="#374151" />
              </TouchableOpacity>
              <Text className="text-xl font-bold text-gray-900">Create Account</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

              {generalError && (
                <View className="bg-red-50 p-3 rounded-lg mb-6 border border-red-100">
                  <Text className="text-red-600 text-sm">{generalError}</Text>
                </View>
              )}

              <Text className="text-gray-500 mb-2">
                One Tap, Brings Yum
              </Text>

              {/* ======================================== */}
              {/* PERSONAL INFORMATION */}
              {/* ======================================== */}
              <SectionHeader title="Personal Information" icon="person-outline" />

              <View className="flex-row space-x-3">
                <View className="flex-1 mb-4">
                  <FormLabel required>First Name</FormLabel>
                  <Controller
                    control={control}
                    name="firstName"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                        placeholder="Juan"
                        placeholderTextColor="#9CA3AF"
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value}
                        autoComplete="given-name"
                        textContentType="givenName"
                        importantForAutofill="yes"
                      />
                    )}
                  />
                  <ErrorMessage message={errors.firstName?.message} />
                </View>

                <View className="flex-1 mb-4">
                  <FormLabel>Middle Name</FormLabel>
                  <Controller
                    control={control}
                    name="middleName"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                        placeholder="Carlos"
                        placeholderTextColor="#9CA3AF"
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value || ''}
                        autoComplete="additional-name"
                        textContentType="middleName"
                        importantForAutofill="yes"
                      />
                    )}
                  />
                  <ErrorMessage message={errors.middleName?.message} />
                </View>
              </View>

              <View className="mb-4">
                <FormLabel required>Last Name</FormLabel>
                <Controller
                  control={control}
                  name="lastName"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                      placeholder="Dela Cruz"
                      placeholderTextColor="#9CA3AF"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      autoComplete="family-name"
                      textContentType="familyName"
                      importantForAutofill="yes"
                    />
                  )}
                />
                <ErrorMessage message={errors.lastName?.message} />
              </View>

              {/* ======================================== */}
              {/* EMAIL & PASSWORD */}
              {/* ======================================== */}
              <SectionHeader title="Email & Password" icon="lock-closed-outline" />

              <View className="mb-4">
                <FormLabel required>Email</FormLabel>
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                      placeholder="juan@example.com"
                      placeholderTextColor="#9CA3AF"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      textContentType="emailAddress"
                      importantForAutofill="yes"
                    />
                  )}
                />
                <ErrorMessage message={errors.email?.message} />
              </View>

              <View className="mb-4">
                <FormLabel required>Password</FormLabel>
                <View className="relative">
                  <Controller
                    control={control}
                    name="password"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 pr-12"
                        placeholder="Enter your password"
                        placeholderTextColor="#9CA3AF"
                        secureTextEntry={!showPassword}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value}
                        autoComplete="new-password"
                        textContentType="newPassword"
                        importantForAutofill="yes"
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
                <ErrorMessage message={errors.password?.message} />
              </View>

              {/* ======================================== */}
              {/* TERMS */}
              {/* ======================================== */}
              <View className="flex-row items-center mt-6 mb-8">
                <Controller
                  control={control}
                  name="agreeToTerms"
                  render={({ field: { onChange, value } }) => (
                    <TouchableOpacity
                      className="flex-row items-center"
                      onPress={() => onChange(!value ? true : undefined)}
                    >
                      <View className={`w-6 h-6 rounded border ${value === true ? 'bg-[#eba336] border-[#eba336]' : 'border-gray-300'} items-center justify-center mr-3`}>
                        {value === true && <Ionicons name="checkmark" size={16} color="white" />}
                      </View>
                      <Text className="text-gray-600 flex-1">
                        I agree to the <Text className="text-[#eba336] font-bold">Terms of Service</Text> and <Text className="text-[#eba336] font-bold">Privacy Policy</Text>
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
              <ErrorMessage message={errors.agreeToTerms?.message} />

              <TouchableOpacity
                className={`w-full bg-[#eba336] rounded-xl py-4 items-center mb-8 ${isLoading ? 'opacity-70' : ''}`}
                onPress={handleSubmit(onSubmit)}
                disabled={isLoading}
              >
                <Text className="text-white font-bold text-lg">
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </Text>
              </TouchableOpacity>

              {/* Footer */}
              <View className="flex-row justify-center">
                <Text className="text-gray-500">Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text className="text-[#eba336] font-bold">Sign In</Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}
