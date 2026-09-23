<template>
  <div class="echo-select">
    <div class="control-group">
      <label for="reverberation-select">Select Echo</label>
      <select
        id="reverberation-select"
        :value="currentReverberation"
        @change="$emit('update:currentReverberation', $event.target.value)"
      >
        <option value="1">Hermione Granger</option>
        <option value="2">Harry Potter</option>
        <option value="3">Dobby</option>
        <option value="4">Rubeus Hagrid</option>
        <option value="5">Weasley Twins</option>
        <option value="6">Newt Scamander</option>
        <option value="7">Severus Snape</option>
        <option value="8">Neville Longbottom</option>
        <option value="9">Bellatrix Lestrange</option>
        <option value="10">Luna Lovegood</option>
        <option value="11">Filius Flitwick</option>
        <option value="12">Sirius Black</option>
        <option value="13">Ron Weasley</option>
        <option value="14">Ginny Weasley</option>
        <option value="15">Albus Dumbledore</option>
        <option value="16">Minerva McGonagall</option>
        <option value="17">Lord Voldemort</option>
        <option value="18">Cedric Diggory</option>
        <option value="19">Gellert Grindelwald</option>
      </select>
    </div>
  </div>
</template>

<script>
export default {
  name: 'EchoSelect',
  props: {
    currentReverberation: {
      type: [String, Number],
      required: true,
    },
  },
  emits: ['update:currentReverberation'],
};
</script>

<style scoped>
.echo-select {
  padding: 18px 30px;
  background: transparent;
  border-bottom: 1px solid var(--rule);
}

.control-group {
  margin-bottom: 0;
  max-width: 400px;
}

.control-group label {
  display: block;
  font-family: var(--font-type);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 8px;
  color: var(--ink-faded);
  font-size: 0.85em;
}

select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  font-family: var(--font-type);
  font-size: 0.95em;
  color: var(--ink);
  background: var(--paper-light);
  cursor: pointer;
  transition: border-color 0.25s;
}

select:hover {
  border-color: var(--ink-faded);
}

select:focus {
  outline: none;
  border-color: var(--gold-leaf);
  box-shadow: 0 0 0 2px rgba(var(--gold-rgb), 0.25);
}
</style>
