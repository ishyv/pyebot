import type { GuildCommandContext } from "seyfert";
import {
  Declare,
  Embed,
  Options,
  SubCommand,
  createChannelOption,
  createStringOption,
} from "seyfert";
import { EmbedColors } from "seyfert/lib/common";
import { addManagedChannel } from "@/modules/guild-channels";

const options = {
  label: createStringOption({
    description: "Descripcion corta del canal",
    required: true,
  }),
  channel: createChannelOption({
    description: "Canal de Discord a registrar",
    required: true,
  }),
};

// Registra un canal auxiliar definido por el staff.
@Declare({
  name: "add",
  description: "Registrar un canal opcional",
})
@Options(options)
export default class ChannelAddCommand extends SubCommand {
  async run(ctx: GuildCommandContext<typeof options>) {
    const guildId = ctx.guildId;
    if (!guildId) {
      throw new Error("Guild ID is required to registrar un canal opcional");
    }

    const label = ctx.options.label;
    const channelId = String(ctx.options.channel.id);

    const record = await addManagedChannel(
      guildId,
      label,
      channelId,
      ctx.db.instance,
    );

    const embed = new Embed({
      title: "Canal opcional registrado",
      description: `Se asigno <#${record.channelId}> con etiqueta **${record.label}**`,
      color: EmbedColors.Green,
      fields: [
        {
          name: "Identificador",
          value: record.id,
        },
      ],
    });

    await ctx.write({ embeds: [embed] });
  }
}


