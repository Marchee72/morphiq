import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsScreen } from '../SettingsScreen';
import { useStore } from '../../../presentation/state/store';

describe('SettingsScreen Component', () => {
  beforeEach(() => {
    useStore.setState({
      profiles: [
        { id: 'p1', name: 'Clark Kent', gender: 'male', birthDate: new Date('1990-06-18'), height: 190, createdAt: new Date() },
      ],
      activeProfile: { id: 'p1', name: 'Clark Kent', gender: 'male', birthDate: new Date('1990-06-18'), height: 190, createdAt: new Date() },
      theme: 'system',
    });
  });

  it('renders active profile information, theme options, and data backup actions', () => {
    render(<SettingsScreen />);

    expect(screen.getByText('Configuración')).toBeInTheDocument();
    expect(screen.getAllByText('Clark Kent').length).toBeGreaterThan(0);
    expect(screen.getByText(/APARIENCIA/i)).toBeInTheDocument();
    expect(screen.getByText(/Sistema/i)).toBeInTheDocument();
    expect(screen.getByText(/Respaldos JSON/i)).toBeInTheDocument();
  });

  it('allows changing theme preferences', () => {
    render(<SettingsScreen />);

    const darkChip = screen.getByText(/Oscuro/i);
    fireEvent.click(darkChip);

    expect(useStore.getState().theme).toBe('dark');
  });

  it('opens edit profile sheet when clicking edit button', () => {
    render(<SettingsScreen />);

    const editBtn = screen.getByText(/Editar/i);
    fireEvent.click(editBtn);

    expect(screen.getByText('Editar Perfil')).toBeInTheDocument();
  });
});
