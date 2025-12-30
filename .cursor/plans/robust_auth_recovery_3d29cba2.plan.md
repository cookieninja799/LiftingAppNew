---
name: Robust auth recovery
overview: Add an in-app Supabase password-recovery flow (forgot password + reset password via deep link) and rework auth gating so deep links can reach the reset screen even when logged out.
todos:
  - id: auth-routes
    content: "Add `(auth)` routes: `sign-in`, `forgot-password`, `reset-password` screens using Supabase auth APIs."
    status: pending
  - id: root-gating
    content: Refactor `app/_layout.tsx` to use router-based redirects so reset deep links work when logged out.
    status: pending
    dependencies:
      - auth-routes
  - id: forgot-password
    content: Implement `resetPasswordForEmail` with `Linking.createURL('/reset-password')` and success UI.
    status: pending
    dependencies:
      - auth-routes
  - id: reset-password
    content: Implement deep-link token parsing, `setSession`, and `updateUser({password})` flow, then navigate into tabs.
    status: pending
    dependencies:
      - auth-routes
      - root-gating
  - id: auth-errors
    content: Add friendly error mapping for sign-in/sign-up and surface actionable messages.
    status: pending
    dependencies:
      - auth-routes
---

# Robust sign-in (Forgot Password)

## What I found in your code

- Your current auth UI is `screens/AuthScreen.tsx` and it only supports sign-in/sign-up with a single generic error alert:
```22:48:/home/cookieninja/LiftingAppNew/screens/AuthScreen.tsx
  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        Alert.alert('Success', 'Check your email for the confirmation link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };
```




- Your root layout currently **bypasses Expo Router entirely** when logged out:
```56:66:/home/cookieninja/LiftingAppNew/app/_layout.tsx
function RootLayoutNav() {
  const { session, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!session) {
    return <AuthScreen />;
  }
```


That means a Supabase recovery deep link like `liftingappnew://reset-password?...` would open the app but still render `AuthScreen`, preventing an in-app reset flow.

## Plan (in-app deep-link password reset)

### 1) Route-based auth screens (so deep links work while logged out)

- Create a new Expo Router auth group:
- Add `[...]/app/(auth)/sign-in.tsx `(replaces/hosts the current `AuthScreen` UI)
- Add `[...]/app/(auth)/forgot-password.tsx` (request reset email)
- Add `[...]/app/(auth)/reset-password.tsx` (user sets new password after opening email link)

### 2) Update root auth gating to allow auth routes without a session

- Update `[...]/app/_layout.tsx `to always render a `<Stack />` and use redirects:
- If `session == null`, allow only `/sign-in`, `/forgot-password`, `/reset-password`.
- If `session != null`, redirect away from auth routes into `/(tabs)`.

### 3) Implement “Forgot password” (send email)

- In `forgot-password.tsx`:
- Call `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
- Compute `redirectTo` via `expo-linking` (e.g. `Linking.createURL('/reset-password')`)
- Confirm UX: show a success message instructing the user to check email.

### 4) Implement “Reset password” (consume token + update password)

- In `reset-password.tsx`:
- Read the opened URL (handle both query params and `#` fragment params)
- Extract `access_token` + `refresh_token` + `type=recovery`
- Call `supabase.auth.setSession({ access_token, refresh_token })`
- Call `supabase.auth.updateUser({ password: newPassword })`
- Then navigate to `/(tabs)` (or optionally sign out and return to sign-in; we can pick one default).

### 5) Make sign-in errors more helpful

- Add lightweight error mapping (invalid credentials vs unconfirmed email vs network) to show user-friendly copy on `sign-in.tsx`.

### 6) Supabase dashboard config (required)

- You’ll need to add redirect URLs in Supabase Auth settings:
- Production: `liftingappnew://reset-password`
- Dev (Expo): whatever `Linking.createURL('/reset-password')` produces in your dev environment (often includes `--/reset-password`)

## Files to change/add

- Update: [`/home/cookieninja/LiftingAppNew/app/_layout.tsx`](/home/cookieninja/LiftingAppNew/app/_layout.tsx)
- Add: `/home/cookieninja/LiftingAppNew/app/(auth)/sign-in.tsx`
- Add: `/home/cookieninja/LiftingAppNew/app/(auth)/forgot-password.tsx`
- Add: `/home/cookieninja/LiftingAppNew/app/(auth)/reset-password.tsx`