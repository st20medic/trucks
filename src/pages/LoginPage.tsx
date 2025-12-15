import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Truck, LogIn } from 'lucide-react';
import { signIn } from '../services/firebase';
import { mockSignIn } from '../services/mockAuth';
import { shouldUseMockServices } from '../config/config';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Attempting login with:', data.email);
      
      let user;
      if (shouldUseMockServices()) {
        console.log('Using mock authentication');
        user = await mockSignIn(data.email, data.password);
      } else {
        console.log('Using Firebase authentication');
        user = await signIn(data.email, data.password);
      }
      
      console.log('Login successful:', user);
      
      // Redirect to dashboard
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ems-blue to-ems-blue-dark flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-white rounded-full flex items-center justify-center mb-4">
            <Truck className="h-8 w-8 text-ems-blue" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">
            Lincoln EMS
          </h2>
          <p className="text-ems-blue-light">
            Truck Tracker System
          </p>
          {shouldUseMockServices() && (
            <div className="mt-2 p-2 bg-yellow-100 text-yellow-800 rounded text-sm">
              🔧 Using Mock Services (Local Development)
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                {...register('email')}
                type="email"
                id="email"
                className="input-field w-full"
                placeholder="Enter your email"
                disabled={isLoading}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                {...register('password')}
                type="password"
                id="password"
                className="input-field w-full"
                placeholder="Enter your password"
                disabled={isLoading}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <LogIn className="h-5 w-5 mr-2" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {shouldUseMockServices() && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700">
                💡 <strong>Local Development Mode:</strong> Any email/password combination will work for testing.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
