import * as vscode from 'vscode' ;
import packageJson from "../../package.json" ;
import { Cache } from "./cache" ;
export const properties = Object . freeze ( packageJson . contributes . configuration [ 0 ] . properties ) ;
export const applicationName = packageJson . displayName ;
//export const applicationKey = packageJson . name ;
export class Entry < valueT >
{
    public defaultValue : valueT ;
    public minValue : valueT | undefined ;
    public maxValue : valueT | undefined ;
    public constructor
    (
        public key : keyof typeof properties ,
        public validator ? : ( value : valueT ) => boolean
    )
    {
        this . defaultValue = ( < any > properties ) [ key ] . default ;
        this . minValue = ( < any > properties ) [ key ] . minimum ;
        this . maxValue = ( < any > properties ) [ key ] . maximum ;
    }
    regulate = ( rawKey : string , value : valueT ) : valueT =>
    {
        let result = value ;
        if ( this . validator && ! this . validator ( result ) )
        {
            // settings.json をテキストとして直接編集してる時はともかく GUI での編集時に無駄にエラー表示が行われてしまうので、エンドユーザーに対するエラー表示は行わない。
            // vscode . window . showErrorMessage (`${ rawKey } setting value is invalid! Please check your settings.`);
            console . error ( `"${ rawKey }" setting value( ${ JSON.stringify ( value ) } ) is invalid! Please check your settings.`);
            result = this . defaultValue ;
        }
        else
        {
            if (undefined !== this . minValue && result < this . minValue)
            {
                result = this . minValue;
            }
            else
            if (undefined !== this.maxValue && this.maxValue < result)
            {
                result = this.maxValue;
            }
        }
        return result;
    };
    getApplicationKey = ( ) => this . key . replace ( /\..*/ , "" ) ;
    getSection = ( ) => this . key . replace ( /[^.]+\./ , "" ) ;
    cache = new Cache
    (
        ( languageId : string ) : valueT =>
        {
            let result : valueT ;
            if ( undefined === languageId || null === languageId || 0 === languageId . length )
            {
                result = < valueT > vscode . workspace . getConfiguration ( this . getApplicationKey ( ) ) [ this . getSection ( ) ] ;
                if (undefined === result)
                {
                    result = this . defaultValue ;
                }
                else
                {
                    result = this . regulate ( this . key , result ) ;
                }
            }
            else
            {
                const langSection = vscode . workspace . getConfiguration ( `[${ languageId }]` , null ) ;
                result = < valueT > langSection [ this . key ] ;
                if ( undefined === result )
                {
                    result = this . get ( "" ) ;
                }
                else
                {
                    result = this . regulate ( `[${ languageId }].${ this.key }`, result ) ;
                }
            }
            return result ;
        }
    );
    public set = async ( value : valueT , configurationTarget ? : vscode . ConfigurationTarget | boolean ) =>
    {
        await vscode . workspace . getConfiguration ( this . getApplicationKey ( ) ) .update ( this . getSection ( ) , value , configurationTarget ) ;
        this . clear ( ) ;
    };
    public get = this . cache . get ;
    public getCache = this . cache . getCache ;
    public clear = this . cache . clear ;
    public onDidChangeConfiguration =
    (
        affectsConfiguration : (section : string , scope ? : vscode . ConfigurationScope ) => boolean
    ) =>
    {
        const result = affectsConfiguration ( this . key ) ;
        if ( result )
        {
            this . clear ( ) ;
        }
        return result ;
    } ;
}
export class MapEntry < ObjectT >
{
    public constructor
    (
        public key : keyof typeof properties,
        public mapObject : ObjectT
    )
    {
    }
    config = new Entry < keyof ObjectT > ( this .key , makeEnumValidator ( this . mapObject ) ) ;
    public set = this . config . set ;
    public get = ( languageId : string ) => this . mapObject [ this . config . cache . get ( languageId ) ] ;
    public getCache = ( languageId : string ) =>
        this . mapObject [ this . config . cache . getCache ( languageId ) ] ;
    public clear = this . config . cache . clear ;
    public onDidChangeConfiguration = this . config . onDidChangeConfiguration ;
}
export const makeEnumValidator = < ObjectT > ( mapObject : ObjectT ) : ( value : keyof ObjectT ) => boolean => ( value : keyof ObjectT ) : boolean =>
    0 <= Object . keys ( mapObject ) . indexOf ( value . toString ( ) ) ;
export const stringArrayValidator = ( value : string [ ] ) =>
    "[object Array]" === Object . prototype . toString . call ( value ) &&
    value . map ( i => "string" === typeof i) . reduce ( ( a , b ) => a && b , true ) ;
