<script lang="ts">
import Callout from "$lib/guide/components/Callout.svelte";
import Steps from "$lib/guide/components/Steps.svelte";
</script>

<p>
  offers let members submit a deal or prompt that goes live in your channels after
  a moderator approves it.
</p>

<p>
  a member runs /offer in discord to submit an offer. it lands in a review queue
  where a moderator can approve it, reject it, or ask for changes. approved offers
  post to the channel and close on their own when the time limit runs out.
</p>

<h2>set it up</h2>
<Steps steps={[
  "enable the offers feature on the features page.",
  "choose where offer prompts and approved posts should appear.",
  "tell members to use /offer when they want to submit one.",
  "have moderators review the queue before anything goes public.",
]} />

<Callout variant="note">
  offers are best for servers that want member-submitted promos without letting
  every promo hit the channel unreviewed.
</Callout>
