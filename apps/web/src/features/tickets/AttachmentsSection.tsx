import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Paperclip, Trash2, Upload } from 'lucide-react';
import type { AttachmentDto } from '@helpdesk/shared';
import { api, ApiRequestError } from '../../lib/api';
import { useAuth } from '../auth/use-auth';
import { toast } from '../../components/ui';

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentsSection({ ticketId }: { ticketId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const query = useQuery({
    queryKey: ['attachments', ticketId],
    queryFn: () => api.get<AttachmentDto[]>(`/api/v1/tickets/${ticketId}/attachments`),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/v1/tickets/${ticketId}/attachments`, {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new ApiRequestError(res.status, data?.error?.code ?? 'INTERNAL_ERROR', data?.error?.message ?? 'Upload failed');
      return data as AttachmentDto;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', ticketId] });
      toast('File uploaded');
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Upload failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/attachments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', ticketId] });
      toast('Attachment deleted');
    },
    onError: (e) => toast(e instanceof ApiRequestError ? e.message : 'Delete failed'),
  });

  const items = query.data ?? [];

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          Attachments {items.length > 0 && <span className="text-slate-400">({items.length})</span>}
        </h3>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {uploadMutation.isPending ? 'Uploading…' : 'Upload file'}
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept="image/*,.pdf,.txt,.csv,.zip,.json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadMutation.mutate(f);
          }}
        />
      </div>

      {items.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400">
          <Paperclip className="mr-1.5 inline h-4 w-4" />
          No attachments yet
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {items.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div className="flex min-w-0 items-center gap-3">
                <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <a
                    href={`/api/v1/attachments/${a.id}`}
                    className="block truncate font-medium text-slate-800 hover:text-brand-600"
                  >
                    {a.originalFilename}
                  </a>
                  <span className="text-xs text-slate-400">
                    {fmtBytes(a.sizeBytes)} · {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={`/api/v1/attachments/${a.id}`}
                  aria-label="Download"
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Download className="h-4 w-4" />
                </a>
                {(user!.role === 'ADMIN' || a.uploaderId === user!.id) && (
                  <button
                    onClick={() => deleteMutation.mutate(a.id)}
                    aria-label="Delete attachment"
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
