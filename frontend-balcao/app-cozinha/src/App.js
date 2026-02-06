import React, { useState, useEffect } from 'react';
import './App.css';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

function App() {
  const [pedidos, setPedidos] = useState([]);
  
  useEffect(() => {
    // Conectar ao socket como cozinha
    socket.emit('cozinha_connect');
    
    // Buscar pedidos iniciais
    fetchPedidos();
    
    // Escutar por pedidos atualizados
    socket.on('pedido_atualizado', (pedidoAtualizado) => {
      setPedidos(prev => 
        prev.map(p => p._id === pedidoAtualizado._id ? pedidoAtualizado : p)
      );
    });
    
    return () => {
      socket.off('pedido_atualizado');
    };
  }, []);
  
  const fetchPedidos = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/pedidos');
      const data = await response.json();
      // Filtrar apenas pedidos que precisam ser preparados
      setPedidos(data.filter(pedido => pedido.status === 'preparando' || pedido.status === 'pronto'));
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
  
  // Filtrar pedidos por status
  const pedidosEmPreparo = pedidos.filter(p => p.status === 'preparando');
  const pedidosProntos = pedidos.filter(p => p.status === 'pronto');
  
  return (
    <div className="App">
      <header className="app-header">
        <h1>Controle de Pedidos - Cozinha</h1>
      </header>
      
      <main className="app-main">
        <div className="pedidos-container">
          <div className="pedidos-em-preparo">
            <h2>Pedidos em Preparo</h2>
            {pedidosEmPreparo.length === 0 ? (
              <p>Nenhum pedido em preparo</p>
            ) : (
              <div className="pedidos-list">
                {pedidosEmPreparo.map(pedido => (
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
                      <button 
                        className="btn-marcar-pronto"
                        onClick={() => atualizarStatusPedido(pedido._id, 'pronto')}>
                        Marcar como Pronto
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="pedidos-prontos">
            <h2>Pedidos Prontos</h2>
            {pedidosProntos.length === 0 ? (
              <p>Nenhum pedido pronto</p>
            ) : (
              <div className="pedidos-list">
                {pedidosProntos.map(pedido => (
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
                      <button 
                        className="btn-entregar"
                        onClick={() => atualizarStatusPedido(pedido._id, 'entregue')}>
                        Entregar Pedido
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
