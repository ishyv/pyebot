<script lang="ts">
import { Select } from "@hyvnt/hyvui";

interface ChannelOption {
  id: string;
  name: string;
  type: string;
}

interface Props {
  name: string;
  value: string;
  channels: readonly ChannelOption[];
  types?: readonly string[];
  placeholder?: string;
}

let { value = $bindable(""), channels, types, placeholder = "no channel" }: Props = $props();

const options = $derived([
  { value: "", label: placeholder },
  ...(types ? channels.filter((c) => types.includes(c.type)) : channels).map((c) => ({
    value: c.id,
    label: `#${c.name}`,
  })),
]);
</script>

<Select bind:value {options} />
