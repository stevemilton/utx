import { getApiConfig, ENDPOINTS } from '../constants/api';
import { useAuthStore } from '../stores/authStore';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

class ApiService {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    const config = getApiConfig();
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout;
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const { method = 'GET', body, headers = {}, skipAuth = false } = options;

    const token = useAuthStore.getState().token;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (!skipAuth && token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `Request failed with status ${response.status}`,
        };
      }

      return {
        success: true,
        data: data.data || data,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timed out',
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Auth endpoints
  async register(userData: {
    firebaseToken: string;
    name: string;
    heightCm: number;
    weightKg: number;
    birthDate: string;
    gender: string;
    maxHr: number;
  }) {
    return this.request(ENDPOINTS.auth.register, {
      method: 'POST',
      body: userData,
      skipAuth: true,
    });
  }

  async verifyToken(firebaseToken: string) {
    return this.request(ENDPOINTS.auth.verifyToken, {
      method: 'POST',
      body: { firebaseToken },
      skipAuth: true,
    });
  }

  // User endpoints
  async getMe() {
    return this.request(ENDPOINTS.users.me);
  }

  async updateProfile(updates: Record<string, unknown>) {
    return this.request(ENDPOINTS.users.updateProfile, {
      method: 'PATCH',
      body: updates,
    });
  }

  async uploadAvatar(imageUri: string) {
    const token = useAuthStore.getState().token;
    const formData = new FormData();
    formData.append('avatar', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'avatar.jpg',
    } as unknown as Blob);

    const response = await fetch(`${this.baseUrl}${ENDPOINTS.users.updateAvatar}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    return response.json();
  }

  // Workout endpoints
  async getWorkouts(params?: { page?: number; limit?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());

    const query = queryParams.toString();
    return this.request(`${ENDPOINTS.workouts.list}${query ? `?${query}` : ''}`);
  }

  async getWorkout(id: string) {
    return this.request(ENDPOINTS.workouts.get(id));
  }

  async createWorkout(workout: Record<string, unknown>) {
    return this.request(ENDPOINTS.workouts.create, {
      method: 'POST',
      body: workout,
    });
  }

  async uploadWorkoutPhoto(imageUri: string) {
    const token = useAuthStore.getState().token;
    const formData = new FormData();
    formData.append('photo', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'erg-screen.jpg',
    } as unknown as Blob);

    const response = await fetch(`${this.baseUrl}${ENDPOINTS.workouts.upload}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    return response.json();
  }

  async processOcr(imageBase64: string) {
    return this.request<{ ocrData: Record<string, unknown> }>(ENDPOINTS.workouts.ocr, {
      method: 'POST',
      body: { imageBase64 },
    });
  }

  async deleteWorkout(id: string) {
    return this.request(ENDPOINTS.workouts.delete(id), {
      method: 'DELETE',
    });
  }

  // Feed endpoints
  async getFeed(type: 'all' | 'squad' | 'following' = 'all', params?: { page?: number }) {
    const endpoint =
      type === 'all'
        ? ENDPOINTS.feed.all
        : type === 'squad'
        ? ENDPOINTS.feed.squad
        : ENDPOINTS.feed.following;

    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());

    const query = queryParams.toString();
    return this.request(`${endpoint}${query ? `?${query}` : ''}`);
  }

  // Reaction endpoints
  async addReaction(workoutId: string) {
    return this.request(ENDPOINTS.reactions.add(workoutId), {
      method: 'POST',
    });
  }

  async removeReaction(workoutId: string) {
    return this.request(ENDPOINTS.reactions.remove(workoutId), {
      method: 'DELETE',
    });
  }

  // Comment endpoints
  async getComments(workoutId: string) {
    return this.request(ENDPOINTS.comments.list(workoutId));
  }

  async addComment(workoutId: string, content: string) {
    return this.request(ENDPOINTS.comments.add(workoutId), {
      method: 'POST',
      body: { content },
    });
  }

  // PB endpoints
  async getPbs() {
    return this.request(ENDPOINTS.pbs.list);
  }

  // Club endpoints
  async searchClubs(query: string) {
    return this.request(`${ENDPOINTS.clubs.search}?q=${encodeURIComponent(query)}`);
  }

  async joinClub(clubId: string, squadId?: string) {
    return this.request(ENDPOINTS.clubs.join(clubId), {
      method: 'POST',
      body: squadId ? { squadId } : undefined,
    });
  }

  async joinClubByCode(inviteCode: string) {
    return this.request('/clubs/join-by-code', {
      method: 'POST',
      body: { inviteCode },
    });
  }

  async createClub(data: { name: string; location?: string }) {
    return this.request(ENDPOINTS.clubs.create, {
      method: 'POST',
      body: data,
    });
  }

  // Squad endpoints
  async joinSquad(squadId: string) {
    return this.request(ENDPOINTS.squads.join(squadId), {
      method: 'POST',
    });
  }

  // Social endpoints
  async followUser(userId: string) {
    return this.request(ENDPOINTS.social.follow(userId), {
      method: 'POST',
    });
  }

  async unfollowUser(userId: string) {
    return this.request(ENDPOINTS.social.unfollow(userId), {
      method: 'DELETE',
    });
  }

  // Leaderboard endpoints
  async getLeaderboard(
    scope: 'global' | 'club' | 'squad' | 'following',
    metric: string,
    scopeId?: string
  ) {
    let endpoint: string;

    switch (scope) {
      case 'club':
        endpoint = ENDPOINTS.leaderboards.club(scopeId!);
        break;
      case 'squad':
        endpoint = ENDPOINTS.leaderboards.squad(scopeId!);
        break;
      case 'following':
        endpoint = ENDPOINTS.leaderboards.following;
        break;
      default:
        endpoint = ENDPOINTS.leaderboards.global;
    }

    return this.request(`${endpoint}?metric=${metric}`);
  }

  // Strava endpoints
  async getStravaAuthUrl() {
    return this.request<{ url: string }>(ENDPOINTS.strava.authUrl);
  }

  async stravaCallback(code: string) {
    return this.request(ENDPOINTS.strava.callback, {
      method: 'POST',
      body: { code },
    });
  }

  async syncToStrava(workoutId: string) {
    return this.request(`${ENDPOINTS.strava.sync}/${workoutId}`, {
      method: 'POST',
    });
  }

  async disconnectStrava() {
    return this.request(ENDPOINTS.strava.disconnect, {
      method: 'POST',
    });
  }
}

export const api = new ApiService();
