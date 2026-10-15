import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StatusBadge, PriorityBadge, ConfirmDialog, Pagination } from './ui';

describe('badges', () => {
  it('renders the human label for each status', () => {
    render(<StatusBadge status="WAITING_FOR_CUSTOMER" />);
    expect(screen.getByText('Waiting for customer')).toBeInTheDocument();
  });

  it('renders priority labels', () => {
    render(<PriorityBadge priority="URGENT" />);
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<ConfirmDialog open={false} title="Delete?" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('fires onConfirm when confirmed and onCancel on Escape', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Delete ticket?" body="Are you sure?" onConfirm={onConfirm} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledOnce();

    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('Pagination', () => {
  it('hides when there is only one page', () => {
    const { container } = render(<Pagination page={1} pageSize={15} total={10} onPage={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('navigates pages', async () => {
    const onPage = vi.fn();
    render(<Pagination page={2} pageSize={15} total={60} onPage={onPage} />);
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPage).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPage).toHaveBeenCalledWith(1);
  });
});
