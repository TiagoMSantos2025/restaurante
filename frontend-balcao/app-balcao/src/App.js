import React, { useState, useEffect } from 'react';
import './App.css';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

function App() {
  const [pedidos, setPedidos] = useState([]);
  
  useEffect(() => {
    // Conectar ao socket como balcão
    socket.emit('balcao_connect');
    
    // Buscar pedidos iniciais
    fetchPedidos();
    
    // Escutar por novos pedidos
    socket.on('novo_pedido', (pedido) => {
      setPedidos(prev => [...prev, pedido]);
    });
    
    // Escutar por atualizações de pedidos
    socket.on('pedido_atualizado', (pedidoAtualizado) => {
      setPedidos(prev => 
        prev.map(p => p._id === pedidoAtualizado._id ? pedidoAtualizado : p)
      );
    });
    
    return () => {
      socket.off('novo_pedido');
      socket.off('pedido_atualizado');
    };
  }, []);
  
  const fetchPedidos = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/pedidos');
      const data = await response.json();
      setPedidos(data);
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
    }
  };
  
  const atualizarStatusPedido = async (pedidoId, novoStatus) => {
    try {
      const response = await fetch(`http://localhost:5000/api/pedidos/${pedidoId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: novoStatus }),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao atualizar pedido');
      }
    } catch (error) {
      console.error('Erro ao atualizar status do pedido:', error);
    }
  };
  
  const getStatusClass = (status) => {
    switch(status) {
      case 'recebido': return 'status-recebido';
      case 'confirmado': return 'status-confirmado';
      case 'preparando': return 'status-preparando';
      case 'pronto': return 'status-pronto';
      case 'entregue': return 'status-entregue';
      default: return '';
    }
  };
  
  return (
    <div className="App">
      <header className="app-header">
        <h1>Controle de Pedidos - Balcão</h1>
      </header>
      
      <main className="app-main">
        <div className="pedidos-container">
          <h2>Pedidos Recebidos</h2>
          {pedidos.length === 0 ? (
            <p>Nenhum pedido recebido</p>
          ) : (
            <div className="pedidos-list">
              {pedidos.map(pedido => (
                <div key={pedido._id} className="pedido-card">
                  <div className="pedido-header">
                    <div className="pedido-info">
                      <span className="pedido-numero">Mesa {pedido.mesa.numero}</span>
                      <span className="pedido-cliente">{pedido.cliente}</span>
                    </div>
                    <span className={`pedido-status ${getStatusClass(pedido.status)}`}>
                      {pedido.status.charAt(0).toUpperCase() + pedido.status.slice(1)}
                    </span>
                  </div>
                  
                  <div className="pedido-itens">
                    {pedido.itens.map((item, index) => (
                      <div key={index} className="pedido-item">
                        <span>{item.quantidade}x {item.item.nome}</span>
                        {item.observacoes && <small>Obs: {item.observacoes}</small>}
                      </div>
                    ))}
                  </div>
                  
                  <div className="pedido-data">
                    {new Date(pedido.dataPedido).toLocaleString()}
                  </div>
                  
                  <div className="pedido-actions">
                    {pedido.status === 'recebido' && (
                      <button 
                        className="btn-confirmar"
                        onClick={() => atualizarStatusPedido(pedido._id, 'confirmado')}>
                        Confirmar Pedido
                      </button>
                    )}
                    
                    {pedido.status === 'confirmado' && (
                      <button 
                        className="btn-enviar-cozinha"
                        onClick={() => atualizarStatusPedido(pedido._id, 'preparando')}>
                        Enviar para Cozinha
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
