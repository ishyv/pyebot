<script lang="ts">
import { Select } from "@hyvnt/hyvui";

interface RoleOption {
  id: string;
  name: string;
  managed?: boolean;
}

interface Props {
  name: string;
  value: string;
  roles: readonly RoleOption[];
  excludeManaged?: boolean;
  placeholder?: string;
}

let {
  value = $bindable(""),
  roles,
  excludeManaged = true,
  placeholder = "no role",
}: Props = $props();

const options = $derived([
  { value: "", label: placeholder },
  ...roles
    .filter((r) => (excludeManaged ? !r.managed : true))
    .map((r) => ({ value: r.id, label: `@${r.name}` })),
]);
</script>

<Select bind:value {options} />
