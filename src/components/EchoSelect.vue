<template>
  <div class="echo-select">
    <div class="control-group">
      <label for="reverberation-select">Select Echo</label>
      <select id="reverberation-select" :value="currentReverberation" @change="$emit('update:currentReverberation', $event.target.value)">
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
      required: true
    }
  },
  emits: ['update:currentReverberation']
}
</script>

<style scoped>
.echo-select {
  padding: 20px 30px;
  background: #f8f9fa;
  border-bottom: 2px solid #e9ecef;
}

.control-group {
  margin-bottom: 0;
  max-width: 400px;
}

.control-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 10px;
  color: #495057;
  font-size: 1.1em;
}

select {
  width: 100%;
  padding: 12px 15px;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  font-size: 1em;
  background: white;
  cursor: pointer;
  transition: all 0.3s;
}

select:hover {
  border-color: #667eea;
}

select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}
</style>
