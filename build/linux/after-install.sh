#!/bin/bash
# Mata qualquer instância anterior do app que tenha ficado rodando após dpkg -r
# Necessário porque dpkg não encerra processos ativos na remoção
pkill -f "claude-usage-monitor" 2>/dev/null || true
pkill -f "Claude Usage Monitor" 2>/dev/null || true
