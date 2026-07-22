import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoachScreen } from '../CoachScreen';
import { useStore } from '../../../presentation/state/store';

describe('CoachScreen Component', () => {
  beforeEach(() => {
    useStore.setState({
      chatHistory: [],
      isAiLoading: false,
      activeProfile: {
        id: 'p1',
        name: 'Tony Stark',
        gender: 'male',
        birthDate: new Date('1985-05-29'),
        height: 185,
        createdAt: new Date(),
      },
    });
  });

  it('renders title, context card, and quick prompts', () => {
    render(<CoachScreen />);

    expect(screen.getByText('Coach AI')).toBeInTheDocument();
    expect(screen.getByText(/Contexto: Perfil, 30d BIA/i)).toBeInTheDocument();
    expect(screen.getByText('Analizar mi entrenamiento esta semana')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Escribe una pregunta para el Coach/i)).toBeInTheDocument();
  });

  it('renders chat messages when present in store', () => {
    useStore.setState({
      chatHistory: [
        { profileId: 'p1', sender: 'user', content: '¿Cómo fue mi semana?', timestamp: new Date() },
        { profileId: 'p1', sender: 'assistant', content: 'Excelente progreso en peso muerto.', timestamp: new Date() },
      ],
    });

    render(<CoachScreen />);

    expect(screen.getByText('¿Cómo fue mi semana?')).toBeInTheDocument();
    expect(screen.getByText('Excelente progreso en peso muerto.')).toBeInTheDocument();
  });
});
