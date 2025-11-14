import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './js/pages/default/home';

describe('Home page', () => {
  test('renders loading state', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByText(/กำลังโหลดข้อมูล/i)).toBeInTheDocument();
  });

  test('renders pharmacy list after loading', async () => {
    // mock fetch
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        json: async () => ({
          data: [
            {
              id: 1,
              attributes: {
                name_th: 'ร้านยาเอ',
                address: '123 ถนนสุขภาพ',
                time_open: '08:00',
                time_close: '20:00',
                phone_store: '0123456789',
                photo_front: { url: '/img.jpg' },
                pharmacy_profiles: { data: [] }
              }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({ data: [] })
      });

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(await screen.findByText(/ร้านยาเอ/)).toBeInTheDocument();
    expect(screen.getByText(/123 ถนนสุขภาพ/)).toBeInTheDocument();
  });

  test('shows no pharmacy found when search does not match', async () => {
    // mock fetch
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        json: async () => ({
          data: [
            {
              id: 1,
              attributes: {
                name_th: 'ร้านยาเอ',
                address: '123 ถนนสุขภาพ',
                time_open: '08:00',
                time_close: '20:00',
                phone_store: '0123456789',
                photo_front: { url: '/img.jpg' },
                pharmacy_profiles: { data: [] }
              }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({ data: [] })
      });

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    // wait for data
    await screen.findByText(/ร้านยาเอ/);
    // ค้นหาด้วยข้อความที่ไม่มีในชื่อร้าน
    const searchInput = screen.getByRole('textbox');
    fireEvent.change(searchInput, { target: { value: 'ไม่มีร้านนี้' } });
    expect(screen.getByText(/ไม่พบข้อมูลร้านยา/)).toBeInTheDocument();
  });
});
