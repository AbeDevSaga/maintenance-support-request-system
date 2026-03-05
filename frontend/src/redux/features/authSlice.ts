// src/redux/features/authSlice.ts
import { createSlice } from '@reduxjs/toolkit';

interface AuthState {
  isAuthenticated: boolean;
  user: any | null;
}

// Check if we have a session (but don't store token in localStorage)
const initialState: AuthState = {
  isAuthenticated: false, // Will be checked by /me endpoint
  user: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.isAuthenticated = true;
      state.user = action.payload.user;
      // NO token storage - it's in httpOnly cookie
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      // NO localStorage cleanup needed
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;