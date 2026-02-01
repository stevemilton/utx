// API Configuration
// Update these values based on your deployment

export const API_CONFIG = {
  // Development
  development: {
    baseUrl: 'http://localhost:3000',
    timeout: 30000,
  },
  // Production - Railway
  production: {
    baseUrl: 'https://utx-production.up.railway.app',
    timeout: 30000,
  },
};

// Get current config based on environment
export const getApiConfig = () => {
  const isDev = __DEV__;
  return isDev ? API_CONFIG.development : API_CONFIG.production;
};

// API Endpoints
export const ENDPOINTS = {
  // Auth
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    verifyToken: '/auth/verify',
    refreshToken: '/auth/refresh',
  },

  // Users
  users: {
    me: '/users/me',
    profile: (id: string) => `/users/${id}`,
    updateProfile: '/users/me',
    updateAvatar: '/users/me/avatar',
  },

  // Workouts
  workouts: {
    list: '/workouts',
    create: '/workouts',
    get: (id: string) => `/workouts/${id}`,
    update: (id: string) => `/workouts/${id}`,
    delete: (id: string) => `/workouts/${id}`,
    upload: '/workouts/upload',
    ocr: '/workouts/ocr',
  },

  // Feed
  feed: {
    all: '/feed',
    squad: '/feed/squad',
    following: '/feed/following',
  },

  // PBs
  pbs: {
    list: '/pbs',
    get: (category: string) => `/pbs/${category}`,
  },

  // Clubs
  clubs: {
    list: '/clubs',
    create: '/clubs',
    get: (id: string) => `/clubs/${id}`,
    search: '/clubs/search',
    join: (id: string) => `/clubs/${id}/join`,
    leave: (id: string) => `/clubs/${id}/leave`,
  },

  // Squads
  squads: {
    list: (clubId: string) => `/clubs/${clubId}/squads`,
    create: (clubId: string) => `/clubs/${clubId}/squads`,
    get: (id: string) => `/squads/${id}`,
    join: (id: string) => `/squads/${id}/join`,
    leave: (id: string) => `/squads/${id}/leave`,
  },

  // Social
  social: {
    follow: (userId: string) => `/users/${userId}/follow`,
    unfollow: (userId: string) => `/users/${userId}/unfollow`,
    followers: (userId: string) => `/users/${userId}/followers`,
    following: (userId: string) => `/users/${userId}/following`,
  },

  // Reactions & Comments
  reactions: {
    add: (workoutId: string) => `/workouts/${workoutId}/reactions`,
    remove: (workoutId: string) => `/workouts/${workoutId}/reactions`,
  },
  comments: {
    list: (workoutId: string) => `/workouts/${workoutId}/comments`,
    add: (workoutId: string) => `/workouts/${workoutId}/comments`,
    delete: (workoutId: string, commentId: string) =>
      `/workouts/${workoutId}/comments/${commentId}`,
  },

  // Leaderboards
  leaderboards: {
    global: '/leaderboards/global',
    club: (clubId: string) => `/leaderboards/club/${clubId}`,
    squad: (squadId: string) => `/leaderboards/squad/${squadId}`,
    following: '/leaderboards/following',
  },

  // Strava
  strava: {
    authUrl: '/strava/auth-url',
    callback: '/strava/callback',
    sync: '/strava/sync',
    disconnect: '/strava/disconnect',
  },
};
