import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const s = localStorage.getItem('fm_session');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  const loginOrganizer = (event) => {
    const s = { role: 'organizer', eventId: event.id, eventName: event.name, event };
    localStorage.setItem('fm_session', JSON.stringify(s));
    setSession(s);
  };

  const loginMerchant = (merchant, event) => {
    const s = { role: 'merchant', merchantId: merchant.id, merchantName: merchant.shop_name, eventId: event.id, eventName: event.name, merchant, event };
    localStorage.setItem('fm_session', JSON.stringify(s));
    setSession(s);
  };

  const logout = () => {
    localStorage.removeItem('fm_session');
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, loginOrganizer, loginMerchant, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
