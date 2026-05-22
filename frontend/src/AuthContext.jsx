import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('fw_token');
    const role = localStorage.getItem('fw_role');
    const username = localStorage.getItem('fw_username');
    if (token && role) setUser({ token, role, username });
  }, []);

  const loginUser = (token, role, username) => {
    localStorage.setItem('fw_token', token);
    localStorage.setItem('fw_role', role);
    localStorage.setItem('fw_username', username);
    setUser({ token, role, username });
  };

  const logoutUser = () => {
    localStorage.removeItem('fw_token');
    localStorage.removeItem('fw_role');
    localStorage.removeItem('fw_username');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loginUser, logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
