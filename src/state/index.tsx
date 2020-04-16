import React, { createContext, useContext, useState } from 'react';
import { TwilioError } from 'twilio-video';
import useFirebaseAuth from './useFirebaseAuth/useFirebaseAuth';
import usePasscodeAuth from './usePasscodeAuth/usePasscodeAuth';
import { User } from 'firebase';

export interface StateContextType {
  error: TwilioError | null;
  setError(error: TwilioError | null): void;
  getToken(name: string, room: string, passcode?: string): Promise<string>;
  getTokenWithJwt(jwt: string, jwtHost: string): Promise<any>;
  user?: User | null | { displayName: undefined; photoURL: undefined; passcode?: string };
  signIn?(passcode?: string): Promise<void>;
  signOut?(): Promise<void>;
  isAuthReady?: boolean;
  isFetching: boolean;
}

export const StateContext = createContext<StateContextType>(null!);

/*
  The 'react-hooks/rules-of-hooks' linting rules prevent React Hooks fron being called
  inside of if() statements. This is because hooks must always be called in the same order
  every time a component is rendered. The 'react-hooks/rules-of-hooks' rule is disabled below
  because the "if (process.env.REACT_APP_SET_AUTH === 'firebase')" statements are evaluated
  at build time (not runtime). If the statement evaluates to false, then the code is not
  included in the bundle that is produced (due to tree-shaking). Thus, in this instance, it
  is ok to call hooks inside if() statements.
*/
export default function AppStateProvider(props: React.PropsWithChildren<{}>) {
  const [error, setError] = useState<TwilioError | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  let contextValue = {
    error,
    setError,
    isFetching,
  } as StateContextType;

  if (process.env.REACT_APP_SET_AUTH === 'firebase') {
    contextValue = {
      ...contextValue,
      ...useFirebaseAuth(), // eslint-disable-line react-hooks/rules-of-hooks
    };
  } else if (process.env.REACT_APP_SET_AUTH === 'passcode') {
    contextValue = {
      ...contextValue,
      ...usePasscodeAuth(), // eslint-disable-line react-hooks/rules-of-hooks
    };
  } else if (process.env.REACT_APP_AUTH === 'jwt') {
    contextValue = {
      ...contextValue,
      getTokenWithJwt: async (jwt, jwtHost) => {
        const headers = new window.Headers();
        const endpoint = jwtHost;
        const params = new window.URLSearchParams({ jwt });

        return fetch(`//${endpoint}/video_chat_sessions/token?${params}`, { headers })
          .then(res => {
            if (res.ok) {
              return res.json();
            } else {
              console.log('response not ok', res);
              return Promise.reject(res);
            }
          })
          .catch(res => res.json().then((json: any) => Promise.reject(json)));
      },
    };
  } else {
    contextValue = {
      ...contextValue,
      getToken: async (identity, roomName) => {
        const headers = new window.Headers();
        const endpoint = process.env.REACT_APP_TOKEN_ENDPOINT || '/token';
        const params = new window.URLSearchParams({ identity, roomName });

        return fetch(`${endpoint}?${params}`, { headers }).then(res => res.text());
      },
    };
  }

  const getToken: StateContextType['getToken'] = (name, room) => {
    setIsFetching(true);
    return contextValue
      .getToken(name, room)
      .then(res => {
        setIsFetching(false);
        return res;
      })
      .catch(err => {
        setError(err);
        setIsFetching(false);
        return Promise.reject(err);
      });
  };

  const getTokenWithJwt: StateContextType['getTokenWithJwt'] = (jwt, jwtHost) => {
    setIsFetching(true);
    return contextValue
      .getTokenWithJwt(jwt, jwtHost)
      .then(res => {
        setIsFetching(false);
        return res;
      })
      .catch(error => {
        setError({
          code: error.code,
          name: error.error,
          message: error.message,
          cta_label: 'Close',
          cta_action: () => window.close(),
        });
        setIsFetching(false);
        return Promise.reject(error);
      });
  };

  return (
    <StateContext.Provider value={{ ...contextValue, getToken, getTokenWithJwt }}>
      {props.children}
    </StateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(StateContext);
  if (!context) {
    throw new Error('useAppState must be used within the AppStateProvider');
  }
  return context;
}
