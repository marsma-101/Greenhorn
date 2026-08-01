export interface Skill {
  id: string;
  name: string;
  description?: string;
  prompt: string;
  trigger: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
