import { notifySlack } from "./notifications";
import { names, fluxoanomalo, queda, voltou, down, rancherFail } from './common/messages.json';
import { rancherInterval } from "./common/config";
import { restart } from "./rancher";
import { checkRabbit } from "./rabbit";

/*
Módulo que trata os eventos de baixo publish e quedas de publish (Quedas da geocontrol)
*/


/**
 * Executa notificações no slack e restarts no rancher em caso de quedas de velocidade de publish
 * @param publishRate velocidade de fluxo que chega da Geocontrol via logstash
 */
export async function lowPublish ( publishRate: number ) {

    if ( publishRate != 0 ) {
        let msg = `${fluxoanomalo}${publishRate} msgs/s`;
        await notifySlack( msg, names.alert );
    } else if ( publishRate == 0 ) {

        let msg = queda;
        await notifySlack( msg, names.bug );

        let resetCount: number = 0; // contador de tentativas de reconexão
        while ( publishRate == 0 ) {
            try {
                await restart( rancherInterval ); // reinicia o serviço e aguarda 3 minutos
            } catch ( erro ) {
                let message = `${rancherFail}${erro.message} Tentativa ${resetCount++}`;
                await notifySlack( message, names.note );
            }
            let status: any = await checkRabbit();
            if ( status ) {
                publishRate = status[ 0 ].message_stats.publish_details.rate;
                let deliveryRate = status[ 0 ].message_stats.deliver_details.rate;
                if ( publishRate > 0 ) {
                    let message = `${voltou}Velocidade de publish: ${publishRate} msgs/s ` +
                        `Velocidade de Delivery: ${deliveryRate} msgs/s`;
                    await notifySlack( message, names.ok );
                    resetCount = 0;
                    break; // só por via das dúvidas... afinal isso não é uma ciência exata..
                } else {
                    let message = `${down}${resetCount++}`;
                    await notifySlack( message, names.note );
                    //volta ao inicio do while e tenta denovo até voltar
                }
            }
        }
    }
}
