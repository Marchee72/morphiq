import React from 'react';
import { AppBar } from '../../ui/primitives/AppBar';
import { EmptyState } from '../../ui/primitives/EmptyState';

export const ComingSoonScreen: React.FC<{ title: string; description: string; icon: React.ReactNode }> = ({ title, description, icon }) => (
  <>
    <AppBar title={title} />
    <div style={{ padding: '0 16px' }}>
      <EmptyState icon={icon} title={description} />
    </div>
  </>
);
