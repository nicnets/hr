'use client';

import { useState, Suspense, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [companyName, setCompanyName] = useState('ForceFriction AI');

  useEffect(() => {
    fetch('/api/public/config')
      .then(res => res.json())
      .then(data => {
        if (data.companyName) setCompanyName(data.companyName);
      })
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="name@forcefriction.ai"
          required
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          disabled={isLoading}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign In'}
      </Button>
    </form>
  );
}

function LoginCard() {
  const [companyName, setCompanyName] = useState('ForceFriction AI');

  useEffect(() => {
    fetch('/api/public/config')
      .then(res => res.json())
      .then(data => {
        if (data.companyName) setCompanyName(data.companyName);
      })
      .catch(() => {});
  }, []);

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">{companyName}</CardTitle>
        <CardDescription className="text-center">
          HR Portal - Sign in to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<div className="text-center py-4">Loading...</div>}>
          <LoginForm />
        </Suspense>
      </CardContent>
      <CardFooter className="flex flex-col space-y-2 text-sm text-muted-foreground text-center" />
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center py-4">Loading...</div>}>
      <LoginCard />
    </Suspense>
  );
}
