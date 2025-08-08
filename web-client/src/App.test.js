import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock react-router-dom to avoid loading the actual library which is ESM only
jest.mock(
  'react-router-dom',
  () => ({
    BrowserRouter: ({ children }) => <div>{children}</div>,
    Routes: ({ children }) => <div>{children}</div>,
    Route: ({ element }) => element,
    Navigate: () => null,
    useLocation: () => ({ pathname: '/', state: null }),
    useNavigate: () => () => {},
    useParams: () => ({}),
  }),
  { virtual: true }
);

// Mock global fetch used in Home component
beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
  );
});

afterEach(() => {
  jest.resetAllMocks();
});

import App from './App';

test('renders home page heading', async () => {
  render(<App />);
  const heading = await screen.findByText(/ร้านยา:/i);
  expect(heading).toBeInTheDocument();
});
