import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { z } from 'zod';
import smcLogo from '@/assets/smc-logo.jpeg';

const signUpSchema = z.object({
  name: z.string().trim().min(2, 'Name muss mindestens 2 Zeichen haben').max(100, 'Name zu lang'),
  email: z.string().trim().email('Ungültige E-Mail-Adresse').max(255, 'E-Mail zu lang'),
  password: z.string().min(6, 'Passwort muss mindestens 6 Zeichen haben').max(100, 'Passwort zu lang'),
  grade: z.string().trim().min(1, 'Klasse ist erforderlich').max(50, 'Klasse zu lang')
});

const signInSchema = z.object({
  email: z.string().trim().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(1, 'Passwort ist erforderlich')
});

const Auth = () => {
  const navigate = useNavigate();
  const { signUp, signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [signUpData, setSignUpData] = useState({
    name: '',
    email: '',
    password: '',
    grade: ''
  });
  
  const [signInData, setSignInData] = useState({
    email: '',
    password: ''
  });

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = signUpSchema.parse(signUpData);
      const { error } = await signUp(validated.email, validated.password, validated.name, validated.grade);
      
      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Diese E-Mail ist bereits registriert. Bitte melde dich an.');
        } else {
          toast.error(error.message || 'Registrierung fehlgeschlagen');
        }
      } else {
        toast.success('Konto erfolgreich erstellt!');
        navigate('/');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('Ein Fehler ist bei der Registrierung aufgetreten');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = signInSchema.parse(signInData);
      const { error } = await signIn(validated.email, validated.password);
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Ungültige E-Mail oder Passwort');
        } else {
          toast.error(error.message || 'Anmeldung fehlgeschlagen');
        }
      } else {
        toast.success('Erfolgreich angemeldet!');
        navigate('/');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('Ein Fehler ist bei der Anmeldung aufgetreten');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-card)]">
        <CardHeader className="text-center">
          <img src={smcLogo} alt="SMC Logo" className="mx-auto mb-4 w-16 h-16 rounded-full object-cover" />
          <CardTitle className="text-2xl font-bold">Amy Johnson Gymnasium</CardTitle>
          <CardDescription>Kaufe und verkaufe Schulmaterialien mit deinen Mitschülern</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Anmelden</TabsTrigger>
              <TabsTrigger value="signup">Registrieren</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">E-Mail</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="your.email@school.com"
                    value={signInData.email}
                    onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Passwort</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={signInData.password}
                    onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Anmelden...' : 'Anmelden'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Vollständiger Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={signUpData.name}
                    onChange={(e) => setSignUpData({ ...signUpData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Schul-E-Mail</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your.email@school.com"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-grade">Klasse</Label>
                  <Input
                    id="signup-grade"
                    type="text"
                    placeholder="z.B. 10. Klasse"
                    value={signUpData.grade}
                    onChange={(e) => setSignUpData({ ...signUpData, grade: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Passwort</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Mindestens 6 Zeichen"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Konto wird erstellt...' : 'Konto erstellen'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;