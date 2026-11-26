import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, type RequestMeta } from "@/api/handler";
import { FetchError } from "@/lib/errors";
import {
  comparePatterns,
  ListPatternsResponseSchema,
  PatternSchema,
  type DeletePatternRequest,
  type SavedPattern,
  type SavePatternRequest,
} from "@/lib/stencil/types";

export const patternsKey = (userId: number) => ["stencil", "list", userId];

const SILENT: RequestMeta = { silent: true };

async function fetchPatterns(signal: AbortSignal): Promise<SavedPattern[]> {
  try {
    const raw = await apiFetch<unknown>("tools", "/stencil/list", { signal });
    return ListPatternsResponseSchema.parse(raw ?? {})
      .patterns.slice()
      .sort(comparePatterns);
  } catch (error) {
    if (error instanceof FetchError && error.status === 404) return [];
    throw error;
  }
}

export function usePatterns(userId: number) {
  return useQuery<SavedPattern[], FetchError>({
    queryKey: patternsKey(userId),
    queryFn: ({ signal }) => fetchPatterns(signal),
    staleTime: 60 * 1000,
  });
}

export function useSavePattern(userId: number) {
  const queryClient = useQueryClient();
  return useMutation<SavedPattern, FetchError, SavePatternRequest>({
    mutationFn: async (request) => {
      const raw = await apiFetch<unknown>("tools", "/stencil/save", {
        method: "POST",
        body: request,
      });
      return PatternSchema.parse(raw);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<SavedPattern[]>(patternsKey(userId), (list) => {
        if (!list) return list;
        const rest = list.filter((entry) => entry.id !== saved.id);
        return [...rest, saved].sort(comparePatterns);
      });
    },
    meta: SILENT,
  });
}

export function useDeletePattern(userId: number) {
  const queryClient = useQueryClient();
  return useMutation<unknown, FetchError, DeletePatternRequest>({
    mutationFn: async (request) => {
      try {
        return await apiFetch<unknown>("tools", "/stencil/delete", {
          method: "POST",
          body: request,
        });
      } catch (error) {
        if (error instanceof FetchError && error.status === 404) return null;
        throw error;
      }
    },
    onSuccess: (_data, { id }) => {
      queryClient.setQueryData<SavedPattern[]>(patternsKey(userId), (list) =>
        list ? list.filter((entry) => entry.id !== id) : list,
      );
    },
  });
}
