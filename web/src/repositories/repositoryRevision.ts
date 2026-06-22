import { ref } from "vue";

export const repositoryRevision = ref(0);

export function bumpRepositoryRevision(): void {
  repositoryRevision.value += 1;
}
