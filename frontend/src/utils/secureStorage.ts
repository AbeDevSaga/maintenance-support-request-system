
const memoryStorage = new Map<string, any>();

export const secureStorage = {
  setToken: (token: string | null) => {
    if (token) {
      memoryStorage.set('authToken', token);
    } else {
      memoryStorage.delete('authToken');
    }
  },
  
  getToken: (): string | null => {
    return memoryStorage.get('authToken') || null;
  },
  
  setUser: (user: any | null) => {
    if (user) {
      memoryStorage.set('user', user);
    } else {
      memoryStorage.delete('user');
    }
  },
  
  getUser: (): any | null => {
    return memoryStorage.get('user') || null;
  },
  
  clear: () => {
    memoryStorage.clear();
  }
};